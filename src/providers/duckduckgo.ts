import * as cheerio from "cheerio";
import { BaseProvider } from "./base.js";
import { SearchResult, SearchOptions, ProviderCapability } from "../core/types.js";
import { safeFetch } from "../utils/http.js";
import { sanitizeForTerminal } from "../core/security.js";

export class DuckDuckGoProvider extends BaseProvider {
  readonly name = "duckduckgo";
  readonly displayName = "DuckDuckGo (Web)";
  readonly category = "general" as const;
  readonly capabilities: ProviderCapability = {
    supportsFreshness: false,
    supportsCategories: false,
    requiresKey: false,
    rateLimitPerMin: 60,
    category: "general"
  };

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const limit = options.limit ?? 10;
    const timeoutMs = options.timeoutMs ?? 7000;
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

    const res = await safeFetch(searchUrl, {
      timeoutMs,
      headers: {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5"
      }
    });

    if (!res.ok) {
      throw new Error(`DuckDuckGo returned HTTP ${res.status}`);
    }

    const html = await res.text();
    const $ = cheerio.load(html);
    const results: SearchResult[] = [];

    $(".result").each((i, el) => {
      if (results.length >= limit) return false;

      const $el = $(el);
      const $titleLink = $el.find(".result__title .result__a, .result__a");
      if (!$titleLink.length) return;

      const title = $titleLink.text().trim();
      let rawHref = $titleLink.attr("href") || "";

      // Resolve DDG redirect URL wrapper
      let targetUrl = rawHref;
      if (rawHref.includes("/uddg=")) {
        try {
          const u = new URL(rawHref, "https://html.duckduckgo.com");
          const uddg = u.searchParams.get("uddg");
          if (uddg) targetUrl = uddg;
        } catch {
          // keep rawHref
        }
      }

      const snippet = $el.find(".result__snippet").text().trim();

      if (title && targetUrl && targetUrl.startsWith("http")) {
        results.push({
          id: `ddg-${results.length + 1}`,
          title: sanitizeForTerminal(title),
          url: targetUrl,
          snippet: sanitizeForTerminal(snippet),
          source: "DuckDuckGo",
          score: 1.0 - (results.length * 0.05)
        });
      }
    });

    return results;
  }
}
