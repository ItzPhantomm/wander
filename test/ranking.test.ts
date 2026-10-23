import test from "node:test";
import assert from "node:assert/strict";
import { rankAndFuse } from "../src/core/ranking.js";
import { SearchResult } from "../src/core/types.js";

test("Ranking: rankAndFuse applies Reciprocal Rank Fusion across providers", () => {
  const setA: SearchResult[] = [
    { id: "a1", title: "TypeScript Handbook", url: "https://typescriptlang.org/docs", snippet: "Learn typescript", source: "A", score: 1 },
    { id: "a2", title: "JavaScript Info", url: "https://javascript.info", snippet: "Modern JS", source: "A", score: 0.9 }
  ];

  const setB: SearchResult[] = [
    { id: "b1", title: "TypeScript Deep Dive", url: "https://basarat.gitbook.io/typescript", snippet: "Deep dive in typescript", source: "B", score: 1 },
    { id: "b2", title: "TypeScript Handbook Official", url: "https://typescriptlang.org/docs", snippet: "Official typescript documentation", source: "B", score: 0.9 }
  ];

  const ranked = rankAndFuse(
    [
      { providerName: "ProviderA", results: setA },
      { providerName: "ProviderB", results: setB }
    ],
    "TypeScript documentation",
    { maxResults: 10 }
  );

  assert.ok(ranked.length > 0);
  // Multi-provider consensus item should rank at the top
  assert.equal(ranked[0].url, "https://typescriptlang.org/docs");
  assert.equal(ranked[0].source, "ProviderA, ProviderB");
});

test("Ranking: rankAndFuse dampens excessive domain duplicates for diversity", () => {
  const results: SearchResult[] = [
    { id: "1", title: "T1", url: "https://spam.com/1", snippet: "S1", source: "A", score: 1 },
    { id: "2", title: "T2", url: "https://spam.com/2", snippet: "S2", source: "A", score: 0.9 },
    { id: "3", title: "T3", url: "https://spam.com/3", snippet: "S3", source: "A", score: 0.8 },
    { id: "4", title: "T4", url: "https://good.org/doc", snippet: "S4", source: "B", score: 0.75 }
  ];

  const ranked = rankAndFuse(
    [{ providerName: "A", results }],
    "query",
    { maxResults: 10 }
  );

  const topThree = ranked.slice(0, 3);
  const spamCount = topThree.filter(r => r.url.includes("spam.com")).length;
  assert.ok(spamCount <= 2, "Domain diversity should prevent 3 consecutive spam.com entries in top 3");
});
