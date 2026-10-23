import { SearchResult } from "./types.js";

const DEFAULT_RRF_K = 60;

/**
 * Merges and ranks result sets from multiple providers using Reciprocal Rank Fusion (RRF)
 * with query keyword relevance and domain diversity adjustments.
 */
export function rankAndFuse(
  providerResultSets: { providerName: string; results: SearchResult[] }[],
  query: string,
  options: { maxResults?: number } = {}
): SearchResult[] {
  const maxResults = options.maxResults ?? 20;
  const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 1);

  // Map from normalized URL to combined score and result object
  const scoreMap = new Map<string, { result: SearchResult; rrfScore: number; sources: Set<string> }>();

  // 1. Calculate RRF score from each provider
  for (const { providerName, results } of providerResultSets) {
    results.forEach((res, rank) => {
      const url = res.url;
      const rankScore = 1.0 / (DEFAULT_RRF_K + rank + 1);

      if (!scoreMap.has(url)) {
        scoreMap.set(url, {
          result: { ...res },
          rrfScore: rankScore,
          sources: new Set([providerName])
        });
      } else {
        const entry = scoreMap.get(url)!;
        entry.rrfScore += rankScore;
        entry.sources.add(providerName);

        // Keep best snippet
        if (res.snippet.length > entry.result.snippet.length) {
          entry.result.snippet = res.snippet;
        }
      }
    });
  }

  // 2. Apply relevance boosts and term matching
  const scoredItems: SearchResult[] = [];

  for (const [_, entry] of scoreMap) {
    let finalScore = entry.rrfScore * 10.0; // Scale up for readability

    // Multi-source consensus boost: results validated by multiple providers
    if (entry.sources.size > 1) {
      finalScore *= (1.0 + 0.3 * (entry.sources.size - 1));
    }

    const titleLower = entry.result.title.toLowerCase();
    const snippetLower = entry.result.snippet.toLowerCase();

    // Keyword matching bonus
    let matches = 0;
    for (const term of queryTerms) {
      if (titleLower.includes(term)) matches += 2;
      else if (snippetLower.includes(term)) matches += 1;
    }
    if (queryTerms.length > 0) {
      const matchRatio = matches / (queryTerms.length * 2);
      finalScore += matchRatio * 0.5;
    }

    entry.result.score = Math.round(finalScore * 100) / 100;
    entry.result.source = Array.from(entry.sources).join(", ");
    scoredItems.push(entry.result);
  }

  // 3. Sort by final score descending
  scoredItems.sort((a, b) => b.score - a.score);

  // 4. Apply domain diversity dampening
  // (Prevents one domain from dominating top 5 results consecutively)
  const diversified: SearchResult[] = [];
  const domainCounts = new Map<string, number>();

  for (const item of scoredItems) {
    let domain = "unknown";
    try {
      domain = new URL(item.url).hostname;
    } catch {}

    const count = domainCounts.get(domain) ?? 0;
    if (count >= 2 && diversified.length < maxResults * 0.75) {
      // Defer to lower in list to ensure diversity
      continue;
    }
    domainCounts.set(domain, count + 1);
    diversified.push(item);
  }

  // If filtered too aggressively, backfill remaining items
  for (const item of scoredItems) {
    if (diversified.length >= maxResults) break;
    if (!diversified.some(d => d.url === item.url)) {
      diversified.push(item);
    }
  }

  return diversified.slice(0, maxResults);
}
