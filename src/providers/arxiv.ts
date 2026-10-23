import * as cheerio from "cheerio";
import { BaseProvider } from "./base.js";
import { SearchResult, SearchOptions, ProviderCapability } from "../core/types.js";
import { safeFetch } from "../utils/http.js";
import { sanitizeForTerminal } from "../core/security.js";

export class ArXivProvider extends BaseProvider {
  readonly name = "arxiv";
  readonly displayName = "arXiv (Research Papers)";
  readonly category = "science" as const;
  readonly capabilities: ProviderCapability = {
    supportsFreshness: true,
    supportsCategories: true,
    requiresKey: false,
    rateLimitPerMin: 30,
    category: "science"
  };

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const limit = options.limit ?? 5;
    const timeoutMs = options.timeoutMs ?? 7000;
    const apiUrl = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&start=0&max_results=${limit}`;

    const res = await safeFetch(apiUrl, {
      timeoutMs,
      headers: {
        "User-Agent": "WanderSearch/1.0"
      }
    });

    if (!res.ok) {
      throw new Error(`arXiv returned HTTP ${res.status}`);
    }

    const xml = await res.text();
    const $ = cheerio.load(xml, { xmlMode: true });
    const results: SearchResult[] = [];

    $("entry").each((i, el) => {
      const $el = $(el);
      const title = $el.find("title").text().replace(/\s+/g, " ").trim();
      const rawUrl = $el.find("id").text().trim();
      const summary = $el.find("summary").text().replace(/\s+/g, " ").trim();
      const author = $el.find("author name").first().text().trim();
      const published = $el.find("published").text().trim();

      if (title && rawUrl) {
        results.push({
          id: `arxiv-${i + 1}`,
          title: sanitizeForTerminal(title),
          url: rawUrl,
          snippet: sanitizeForTerminal(summary.slice(0, 300) + (summary.length > 300 ? "..." : "")),
          source: "arXiv",
          score: 0.85 - (i * 0.04),
          author: author || undefined,
          publishedDate: published || undefined
        });
      }
    });

    return results;
  }
}
