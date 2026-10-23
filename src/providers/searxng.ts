import { BaseProvider } from "./base.js";
import { SearchResult, SearchOptions, ProviderCapability } from "../core/types.js";
import { safeFetch } from "../utils/http.js";
import { sanitizeForTerminal } from "../core/security.js";
import { logger } from "../utils/logger.js";

const DEFAULT_SEARXNG_INSTANCES = [
  "https://searx.be",
  "https://priv.au",
  "https://paulgo.io",
  "https://search.mdosch.de",
  "https://searx.perennialte.ch"
];

export class SearXNGProvider extends BaseProvider {
  readonly name = "searxng";
  readonly displayName = "SearXNG (Meta-Search)";
  readonly category = "general" as const;
  readonly capabilities: ProviderCapability = {
    supportsFreshness: true,
    supportsCategories: true,
    requiresKey: false,
    rateLimitPerMin: 30,
    category: "general"
  };

  private customInstance?: string;

  constructor(customInstance?: string) {
    super();
    this.customInstance = customInstance;
  }

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const limit = options.limit ?? 10;
    const timeoutMs = options.timeoutMs ?? 5000;

    const instances = this.customInstance
      ? [this.customInstance, ...DEFAULT_SEARXNG_INSTANCES]
      : DEFAULT_SEARXNG_INSTANCES;

    let lastError: Error | null = null;

    for (const instance of instances) {
      try {
        const cleanBase = instance.replace(/\/+$/, "");
        const url = `${cleanBase}/search?q=${encodeURIComponent(query)}&format=json&language=en`;

        const res = await safeFetch(url, {
          timeoutMs,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) WanderSearch/1.0",
            "Accept": "application/json"
          }
        });

        if (!res.ok) {
          continue;
        }

        const contentType = res.headers.get("content-type") || "";
        if (!contentType.includes("json")) {
          logger.debug(`SearXNG instance ${instance} returned non-JSON content-type: ${contentType}`);
          continue;
        }

        const rawText = await res.text();
        let data: any;
        try {
          data = JSON.parse(rawText);
        } catch {
          logger.debug(`SearXNG instance ${instance} returned invalid JSON payload`);
          continue;
        }

        const rawResults = data?.results || [];
        const results: SearchResult[] = [];

        for (let i = 0; i < rawResults.length && results.length < limit; i++) {
          const item = rawResults[i];
          if (!item.url || !item.title) continue;

          results.push({
            id: `searx-${i + 1}`,
            title: sanitizeForTerminal(item.title),
            url: item.url,
            snippet: sanitizeForTerminal(item.content || item.snippet || ""),
            source: `SearXNG (${item.engine || "web"})`,
            score: 0.92 - (i * 0.04),
            publishedDate: item.publishedDate
          });
        }

        if (results.length > 0) {
          return results;
        }
      } catch (err: any) {
        lastError = err;
        logger.debug(`SearXNG instance ${instance} error: ${err.message}`);
      }
    }

    if (lastError) {
      throw lastError;
    }
    return [];
  }
}
