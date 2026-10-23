import {
  SearchResult,
  SearchOptions,
  ParallelSearchOptions,
  ResearchTopic,
  ResearchFinding,
  FetchedContent,
  ProviderStatus,
  WanderConfig
} from "./types.js";
import { BaseProvider, createProviders } from "../providers/index.js";
import { deduplicateResults } from "./deduplication.js";
import { rankAndFuse } from "./ranking.js";
import { SearchCache } from "./cache.js";
import { safeFetch } from "../utils/http.js";
import { extractReadableContent } from "./extractor.js";
import { logger } from "../utils/logger.js";

export class SearchEngine {
  private providers: Map<string, BaseProvider>;
  private cache: SearchCache;
  private config: WanderConfig;

  constructor(config?: Partial<WanderConfig>) {
    this.config = {
      version: "1.0.0",
      hosting: { mode: "local", local: { directMode: true } },
      search: {
        defaultProviders: ["duckduckgo", "wikipedia", "hackernews", "github", "searxng", "arxiv", "crossref"],
        timeoutMs: 6000,
        maxResults: 15,
        cacheTtlMinutes: 30
      },
      ...config
    } as WanderConfig;

    this.providers = createProviders(this.config);
    this.cache = new SearchCache(this.config.search.cacheTtlMinutes);
  }

  getRegisteredProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Performs parallel search across configured providers with deduplication and RRF ranking.
   */
  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const cleanQuery = query.trim();
    if (!cleanQuery) return [];

    const limit = options.limit ?? this.config.search.maxResults;
    const cacheKey = `search:${cleanQuery}:${options.providers?.sort().join(",") || "all"}:${limit}`;

    // Check cache
    if (options.useCache !== false) {
      const cached = this.cache.get<SearchResult[]>(cacheKey);
      if (cached && cached.length > 0) {
        logger.debug(`Cache hit for query "${cleanQuery}"`);
        return cached.slice(0, limit);
      }
    }

    // Determine target providers
    const targetProviderNames = options.providers && options.providers.length > 0
      ? options.providers
      : this.config.search.defaultProviders;

    const activeProviders = targetProviderNames
      .map(name => this.providers.get(name.toLowerCase()))
      .filter((p): p is BaseProvider => p !== undefined);

    if (activeProviders.length === 0) {
      logger.warn("No matching providers found, falling back to all available");
      activeProviders.push(...Array.from(this.providers.values()));
    }

    const timeoutMs = options.timeoutMs ?? this.config.search.timeoutMs;

    // Dispatch parallel queries across providers with bounded timeouts
    const providerTasks = activeProviders.map(async (provider) => {
      const start = Date.now();
      try {
        const results = await provider.search(cleanQuery, {
          ...options,
          limit,
          timeoutMs
        });
        logger.debug(`Provider ${provider.name} returned ${results.length} results in ${Date.now() - start}ms`);
        return {
          providerName: provider.displayName,
          results
        };
      } catch (err: any) {
        logger.warn(`Provider ${provider.name} failed: ${err.message}`);
        return {
          providerName: provider.displayName,
          results: []
        };
      }
    });

    const providerResultSets = await Promise.all(providerTasks);

    // Filter out empty result sets
    const validSets = providerResultSets.filter(s => s.results.length > 0);

    if (validSets.length === 0) {
      logger.info(`All providers returned empty for "${cleanQuery}"`);
      return [];
    }

    // Reciprocal Rank Fusion & Deduplication
    const rankedResults = rankAndFuse(validSets, cleanQuery, { maxResults: limit });
    const finalResults = deduplicateResults(rankedResults).slice(0, limit);

    // Save to cache
    if (finalResults.length > 0 && options.useCache !== false) {
      this.cache.set(cacheKey, finalResults);
    }

    return finalResults;
  }

  /**
   * Parallel search querying multiple variations or sub-topics concurrently.
   */
  async parallelSearch(query: string, options: ParallelSearchOptions = {}): Promise<SearchResult[]> {
    const subQueries = options.subQueries && options.subQueries.length > 0
      ? options.subQueries
      : [
          query,
          `${query} tutorial documentation`,
          `${query} open source github`
        ];

    logger.info(`Running parallel search across ${subQueries.length} query facets`);

    const tasks = subQueries.map(q => this.search(q, { ...options, limit: 10 }));
    const allResults = await Promise.all(tasks);

    // Flatten and rank
    const flattened = allResults.flat();
    const deduped = deduplicateResults(flattened);
    deduped.sort((a, b) => b.score - a.score);

    const limit = options.limit ?? this.config.search.maxResults;
    return deduped.slice(0, limit);
  }

  /**
   * Retrieves a web page safely with SSRF protection and extracts clean markdown.
   */
  async fetchPage(url: string, maxCharacters = 40000): Promise<FetchedContent> {
    const cacheKey = `fetch:${url}:${maxCharacters}`;
    const cached = this.cache.get<FetchedContent>(cacheKey);
    if (cached) {
      return cached;
    }

    const res = await safeFetch(url, {
      timeoutMs: 10000,
      headers: {
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      }
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch ${url}: HTTP ${res.status} ${res.statusText}`);
    }

    const html = await res.text();
    const extracted = extractReadableContent(html, url, { maxCharacters });

    this.cache.set(cacheKey, extracted, 60 * 60 * 1000); // 1 hour fetch cache
    return extracted;
  }

  /**
   * Autonomous research pipeline: queries, gathers multiple sources,
   * reads high-ranked pages, extracts insights, and synthesizes a brief.
   */
  async researchTopic(topic: ResearchTopic): Promise<ResearchFinding> {
    const query = topic.query;
    logger.info(`Starting research on "${query}"`);

    // 1. Run parallel search
    const results = await this.parallelSearch(query, {
      limit: topic.maxSources ?? 8
    });

    if (results.length === 0) {
      return {
        topic: query,
        summary: `No search results found for topic "${query}".`,
        sources: [],
        keyInsights: []
      };
    }

    // 2. Fetch top 3-4 distinct informative sources
    const topResults = results.slice(0, Math.min(results.length, 4));
    const fetchedSources: { title: string; url: string; snippet: string; keyTakeaway?: string }[] = [];
    const insights: string[] = [];

    for (const item of topResults) {
      try {
        const page = await this.fetchPage(item.url, 15000);
        // Extract key sentence from page
        const firstParagraph = page.plainText
          .split("\n")
          .map(s => s.trim())
          .filter(s => s.length > 50)[0] || item.snippet;

        fetchedSources.push({
          title: item.title,
          url: item.url,
          snippet: item.snippet,
          keyTakeaway: firstParagraph.slice(0, 200) + (firstParagraph.length > 200 ? "..." : "")
        });

        if (firstParagraph && insights.length < 5) {
          insights.push(firstParagraph.slice(0, 160));
        }
      } catch (err: any) {
        logger.debug(`Could not extract full content for ${item.url}: ${err.message}`);
        fetchedSources.push({
          title: item.title,
          url: item.url,
          snippet: item.snippet,
          keyTakeaway: item.snippet
        });
      }
    }

    const summary = `Research on "${query}" synthesized from ${fetchedSources.length} primary sources (${topResults.map(r => r.source).join(", ")}). Key themes include ${insights.slice(0, 2).join("; ")}.`;

    return {
      topic: query,
      summary,
      sources: fetchedSources,
      keyInsights: insights.length > 0 ? insights : topResults.map(r => r.snippet)
    };
  }

  /**
   * Runs health checks across all registered providers.
   */
  async checkHealth(): Promise<ProviderStatus[]> {
    const list = Array.from(this.providers.values());
    const tasks = list.map(p => p.healthCheck());
    return await Promise.all(tasks);
  }
}
