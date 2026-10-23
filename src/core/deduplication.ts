import { SearchResult } from "./types.js";

const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "fbclid",
  "gclid",
  "msclkid",
  "mc_cid",
  "mc_eid",
  "_ga",
  "ref",
  "ref_src",
  "source",
  "feature"
]);

/**
 * Normalizes a URL by stripping tracking parameters, hash fragments, and trailing slashes.
 */
export function normalizeUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    parsed.hash = "";

    // Remove tracking query parameters
    const keysToDelete: string[] = [];
    parsed.searchParams.forEach((_, key) => {
      if (TRACKING_PARAMS.has(key.toLowerCase()) || key.toLowerCase().startsWith("utm_")) {
        keysToDelete.push(key);
      }
    });
    for (const key of keysToDelete) {
      parsed.searchParams.delete(key);
    }

    let result = parsed.toString();
    // Strip trailing slash unless it's just http://domain.com/
    if (result.endsWith("/") && parsed.pathname !== "/") {
      result = result.slice(0, -1);
    }
    return result;
  } catch {
    return rawUrl;
  }
}

/**
 * Deduplicates and merges results across multiple providers.
 */
export function deduplicateResults(results: SearchResult[]): SearchResult[] {
  const seenMap = new Map<string, SearchResult>();

  for (const item of results) {
    const norm = normalizeUrl(item.url);

    if (!seenMap.has(norm)) {
      seenMap.set(norm, { ...item, url: norm });
    } else {
      const existing = seenMap.get(norm)!;
      // Multi-provider consensus boost
      existing.score += 0.25;

      // Append source if different
      if (!existing.source.includes(item.source)) {
        existing.source = `${existing.source}, ${item.source}`;
      }

      // Pick richer snippet
      if (item.snippet && item.snippet.length > existing.snippet.length) {
        existing.snippet = item.snippet;
      }

      // Merge metadata
      existing.metadata = { ...existing.metadata, ...item.metadata };
    }
  }

  return Array.from(seenMap.values());
}
