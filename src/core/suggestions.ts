import { safeFetch } from "../utils/http.js";

const suggestionsCache = new Map<string, { items: string[]; expires: number }>();

/**
 * Fetches fast live query suggestions for autocomplete.
 */
export async function getQuerySuggestions(prefix: string, limit = 5): Promise<string[]> {
  const query = prefix.trim().toLowerCase();
  if (!query || query.length < 2) return [];

  const now = Date.now();
  const cached = suggestionsCache.get(query);
  if (cached && cached.expires > now) {
    return cached.items.slice(0, limit);
  }

  try {
    const url = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=${limit}&namespace=0&format=json`;
    const res = await safeFetch(url, {
      timeoutMs: 2500,
      headers: { "User-Agent": "WanderSearch/1.0" }
    });

    if (res.ok) {
      const data = await res.json();
      const suggestions: string[] = Array.isArray(data[1]) ? data[1] : [];
      suggestionsCache.set(query, { items: suggestions, expires: now + 5 * 60 * 1000 });
      return suggestions.slice(0, limit);
    }
  } catch {}

  return [];
}
