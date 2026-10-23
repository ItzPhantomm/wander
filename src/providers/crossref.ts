import { BaseProvider } from "./base.js";
import { SearchResult, SearchOptions, ProviderCapability } from "../core/types.js";
import { safeFetch } from "../utils/http.js";
import { sanitizeForTerminal } from "../core/security.js";

export class CrossrefProvider extends BaseProvider {
  readonly name = "crossref";
  readonly displayName = "Crossref (Scholarly Works)";
  readonly category = "science" as const;
  readonly capabilities: ProviderCapability = {
    supportsFreshness: false,
    supportsCategories: true,
    requiresKey: false,
    rateLimitPerMin: 60,
    category: "science"
  };

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const limit = options.limit ?? 5;
    const timeoutMs = options.timeoutMs ?? 6000;
    const apiUrl = `https://api.crossref.org/works?query=${encodeURIComponent(query)}&rows=${limit}`;

    const res = await safeFetch(apiUrl, {
      timeoutMs,
      headers: {
        "User-Agent": "WanderSearch/1.0 (mailto:community@wander.local)"
      }
    });

    if (!res.ok) {
      throw new Error(`Crossref returned HTTP ${res.status}`);
    }

    const data = await res.json();
    const items = data?.message?.items || [];
    const results: SearchResult[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const title = item.title?.[0] || "Untitled Research";
      const targetUrl = item.URL || (item.DOI ? `https://doi.org/${item.DOI}` : "");
      if (!targetUrl) continue;

      const authors = (item.author || []).map((a: any) => `${a.given || ""} ${a.family || ""}`.trim()).filter(Boolean).slice(0, 3).join(", ");
      const container = item["container-title"]?.[0] || "";
      const year = item.created?.["date-parts"]?.[0]?.[0];

      const snippet = [
        container ? `Published in: ${container}` : "",
        authors ? `Authors: ${authors}` : "",
        year ? `(${year})` : "",
        item.abstract ? item.abstract.replace(/<[^>]+>/g, "").slice(0, 200) : ""
      ].filter(Boolean).join(" | ");

      results.push({
        id: `crossref-${i + 1}`,
        title: sanitizeForTerminal(title),
        url: targetUrl,
        snippet: sanitizeForTerminal(snippet),
        source: "Crossref",
        score: 0.82 - (i * 0.04),
        author: authors || undefined,
        publishedDate: year ? `${year}` : undefined,
        metadata: {
          doi: item.DOI,
          journal: container
        }
      });
    }

    return results;
  }
}
