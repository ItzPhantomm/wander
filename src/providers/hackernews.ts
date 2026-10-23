import { BaseProvider } from "./base.js";
import { SearchResult, SearchOptions, ProviderCapability } from "../core/types.js";
import { safeFetch } from "../utils/http.js";
import { sanitizeForTerminal } from "../core/security.js";

export class HackerNewsProvider extends BaseProvider {
  readonly name = "hackernews";
  readonly displayName = "Hacker News (Tech)";
  readonly category = "tech" as const;
  readonly capabilities: ProviderCapability = {
    supportsFreshness: true,
    supportsCategories: true,
    requiresKey: false,
    rateLimitPerMin: 120,
    category: "tech"
  };

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const limit = options.limit ?? 10;
    const timeoutMs = options.timeoutMs ?? 6000;
    const apiUrl = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&hitsPerPage=${limit}&tags=story`;

    const res = await safeFetch(apiUrl, {
      timeoutMs,
      headers: {
        "User-Agent": "WanderSearch/1.0"
      }
    });

    if (!res.ok) {
      throw new Error(`Hacker News returned HTTP ${res.status}`);
    }

    const data = await res.json();
    const hits = data?.hits || [];
    const results: SearchResult[] = [];

    for (let i = 0; i < hits.length; i++) {
      const hit = hits[i];
      const title = hit.title || hit.story_title || "HN Story";
      // If external url exists, use that; otherwise use the HN discussion link
      const targetUrl = hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`;
      const points = hit.points ?? 0;
      const numComments = hit.num_comments ?? 0;
      const author = hit.author;

      const snippet = hit._highlightResult?.story_text?.value
        ? hit._highlightResult.story_text.value.replace(/<[^>]+>/g, "")
        : `HN Discussion: ${points} points, ${numComments} comments by ${author}`;

      results.push({
        id: `hn-${hit.objectID || i + 1}`,
        title: sanitizeForTerminal(title),
        url: targetUrl,
        snippet: sanitizeForTerminal(snippet),
        source: "Hacker News",
        score: 0.9 - (i * 0.04),
        author,
        publishedDate: hit.created_at,
        metadata: {
          points,
          comments: numComments,
          hnUrl: `https://news.ycombinator.com/item?id=${hit.objectID}`
        }
      });
    }

    return results;
  }
}
