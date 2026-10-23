import test from "node:test";
import assert from "node:assert/strict";
import { normalizeUrl, deduplicateResults } from "../src/core/deduplication.js";
import { SearchResult } from "../src/core/types.js";

test("Deduplication: normalizeUrl strips tracking params, fragments, and trailing slashes", () => {
  const raw = "https://example.com/article/?utm_source=twitter&utm_medium=social&fbclid=123#comments";
  const normalized = normalizeUrl(raw);
  assert.equal(normalized, "https://example.com/article");

  const raw2 = "https://example.com/page/";
  assert.equal(normalizeUrl(raw2), "https://example.com/page");

  const root = "https://example.com/";
  assert.equal(normalizeUrl(root), "https://example.com/");
});

test("Deduplication: deduplicateResults merges duplicates and boosts consensus score", () => {
  const items: SearchResult[] = [
    {
      id: "1",
      title: "Doc One",
      url: "https://example.com/guide?utm_source=feed",
      snippet: "Short snippet",
      source: "DuckDuckGo",
      score: 0.9
    },
    {
      id: "2",
      title: "Doc One Updated",
      url: "https://example.com/guide#heading",
      snippet: "Longer and much more comprehensive guide snippet",
      source: "Wikipedia",
      score: 0.8
    },
    {
      id: "3",
      title: "Doc Two",
      url: "https://example.com/other",
      snippet: "Different page",
      source: "GitHub",
      score: 0.7
    }
  ];

  const deduped = deduplicateResults(items);
  assert.equal(deduped.length, 2);

  const merged = deduped.find(d => d.url === "https://example.com/guide")!;
  assert.ok(merged);
  assert.equal(merged.source, "DuckDuckGo, Wikipedia");
  assert.equal(merged.snippet, "Longer and much more comprehensive guide snippet");
  assert.ok(merged.score > 0.9); // Boosted
});
