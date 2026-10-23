import { BaseProvider } from "./base.js";
import { SearchResult, SearchOptions, ProviderCapability } from "../core/types.js";
import { safeFetch } from "../utils/http.js";
import { sanitizeForTerminal } from "../core/security.js";

export class WikipediaProvider extends BaseProvider {
  readonly name = "wikipedia";
  readonly displayName = "Wikipedia (Encyclopedia)";
  readonly category = "general" as const;
  readonly capabilities: ProviderCapability = {
    supportsFreshness: false,
    supportsCategories: false,
    requiresKey: false,
    rateLimitPerMin: 120,
    category: "general"
  };

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const limit = options.limit ?? 5;
    const timeoutMs = options.timeoutMs ?? 5000;
    const apiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=${limit}&format=json&utf8=1`;

    const res = await safeFetch(apiUrl, {
      timeoutMs,
      headers: {
        "User-Agent": "WanderSearch/1.0 (+https://github.com/ItzPhantomm/wander)"
      }
    });

    if (!res.ok) {
      throw new Error(`Wikipedia returned HTTP ${res.status}`);
    }

    const data = await res.json();
    const items = data?.query?.search || [];
    const results: SearchResult[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const pageTitle = item.title;
      const cleanSnippet = item.snippet
        .replace(/<span class="searchmatch">/g, "")
        .replace(/<\/span>/g, "")
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&amp;/g, "&");

      const pageUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(pageTitle.replace(/ /g, "_"))}`;

      results.push({
        id: `wiki-${item.pageid || i + 1}`,
        title: sanitizeForTerminal(pageTitle),
        url: pageUrl,
        snippet: sanitizeForTerminal(cleanSnippet),
        source: "Wikipedia",
        score: 0.95 - (i * 0.05),
        publishedDate: item.timestamp,
        metadata: {
          wordcount: item.wordcount
        }
      });
    }

    return results;
  }
}
