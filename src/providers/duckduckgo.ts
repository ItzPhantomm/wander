import * as cheerio from "cheerio";
import { BaseProvider } from "./base.js";
import { SearchResult, SearchOptions, ProviderCapability } from "../core/types.js";
import { safeFetch } from "../utils/http.js";
import { sanitizeForTerminal } from "../core/security.js";
import { logger } from "../utils/logger.js";

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

    // 1. Try DuckDuckGo HTML endpoint
    try {
      const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      const res = await safeFetch(searchUrl, {
        timeoutMs,
        headers: {
          "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5"
        }
      });

      if (res.ok) {
        const html = await res.text();
        const results = this.parseHtmlResults(html, limit);
        if (results.length > 0) {
          return results;
        }
      }
    } catch (err: any) {
      logger.debug(`DuckDuckGo HTML endpoint failed: ${err.message}, attempting Lite fallback...`);
    }

    // 2. Fallback to DuckDuckGo Lite endpoint
    try {
      const liteRes = await safeFetch("https://lite.duckduckgo.com/lite/", {
        method: "POST",
        timeoutMs,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) WanderSearch/1.0",
          "Accept": "text/html"
        },
        body: `q=${encodeURIComponent(query)}`
      });

      if (liteRes.ok) {
        const liteHtml = await liteRes.text();
        const results = this.parseLiteResults(liteHtml, limit);
        if (results.length > 0) {
          return results;
        }
      }
    } catch (err: any) {
      logger.debug(`DuckDuckGo Lite fallback failed: ${err.message}`);
    }

    return [];
  }

  private parseHtmlResults(html: string, limit: number): SearchResult[] {
    const $ = cheerio.load(html);
    const results: SearchResult[] = [];

    $(".result").each((i, el) => {
      if (results.length >= limit) return false;

      const $el = $(el);
      const $titleLink = $el.find(".result__title .result__a, .result__a");
      if (!$titleLink.length) return;

      const title = $titleLink.text().trim();
      let rawHref = $titleLink.attr("href") || "";

      let targetUrl = rawHref;
      if (rawHref.includes("/uddg=")) {
        try {
          const u = new URL(rawHref, "https://html.duckduckgo.com");
          const uddg = u.searchParams.get("uddg");
          if (uddg) targetUrl = uddg;
        } catch {}
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

  private parseLiteResults(html: string, limit: number): SearchResult[] {
    const $ = cheerio.load(html);
    const results: SearchResult[] = [];

    $("tr").each((i, el) => {
      if (results.length >= limit) return false;

      const $link = $(el).find("a.result-link");
      if (!$link.length) return;

      const title = $link.text().trim();
      const rawUrl = $link.attr("href") || "";

      let targetUrl = rawUrl;
      if (rawUrl.includes("/uddg=")) {
        try {
          const u = new URL(rawUrl, "https://lite.duckduckgo.com");
          const uddg = u.searchParams.get("uddg");
          if (uddg) targetUrl = uddg;
        } catch {}
      }

      // Next sibling row often contains snippet
      const $snippetTd = $(el).next("tr").find(".result-snippet");
      const snippet = $snippetTd.text().trim();

      if (title && targetUrl && targetUrl.startsWith("http")) {
        results.push({
          id: `ddg-lite-${results.length + 1}`,
          title: sanitizeForTerminal(title),
          url: targetUrl,
          snippet: sanitizeForTerminal(snippet),
          source: "DuckDuckGo (Lite)",
          score: 0.95 - (results.length * 0.05)
        });
      }
    });

    return results;
  }
}
