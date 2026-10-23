import test from "node:test";
import assert from "node:assert/strict";
import { SearchEngine } from "../src/core/engine.js";

test("Engine: instantiates with default providers and handles searches", async () => {
  const engine = new SearchEngine({
    search: {
      defaultProviders: ["wikipedia"],
      timeoutMs: 5000,
      maxResults: 3,
      cacheTtlMinutes: 10
    }
  });

  const providers = engine.getRegisteredProviders();
  assert.ok(providers.includes("duckduckgo"));
  assert.ok(providers.includes("wikipedia"));
  assert.ok(providers.includes("hackernews"));
  assert.ok(providers.includes("github"));

  const results = await engine.search("Linux", { limit: 2, providers: ["wikipedia"] });
  assert.ok(results.length > 0);
  assert.ok(results[0].title);
  assert.ok(results[0].url.startsWith("https://"));

  // Verify caching: second call should resolve from cache immediately
  const start = Date.now();
  const cachedResults = await engine.search("Linux", { limit: 2, providers: ["wikipedia"] });
  const duration = Date.now() - start;
  assert.equal(cachedResults.length, results.length);
  assert.ok(duration < 50, "Cached query should return virtually instantaneously");
});

test("Engine: checkHealth returns status for registered providers", async () => {
  const engine = new SearchEngine();
  const statuses = await engine.checkHealth();
  assert.ok(statuses.length >= 4);

  const wikiStatus = statuses.find(s => s.name === "wikipedia");
  assert.ok(wikiStatus);
  assert.equal(wikiStatus?.isAvailable, true);
});
