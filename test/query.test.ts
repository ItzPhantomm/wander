import test from "node:test";
import assert from "node:assert/strict";
import { parseQuerySyntax, detectInstantAnswer } from "../src/core/query.js";

test("Query: parseQuerySyntax parses search operators", () => {
  const parsed = parseQuerySyntax("rust async site:github.com category:code \"tokio reactor\" -deprecated");
  assert.equal(parsed.cleanQuery.includes("rust async"), true);
  assert.equal(parsed.siteFilter, "github.com");
  assert.equal(parsed.categoryFilter, "code");
  assert.deepEqual(parsed.exactPhrases, ["tokio reactor"]);
  assert.deepEqual(parsed.excludeTerms, ["deprecated"]);
});

test("Query: detectInstantAnswer solves math calculations", () => {
  const calc1 = detectInstantAnswer("25 + 75 * 2");
  assert.ok(calc1);
  assert.equal(calc1?.answer, "175");

  const calc2 = detectInstantAnswer("1024 / 4");
  assert.ok(calc2);
  assert.equal(calc2?.answer, "256");

  const nonCalc = detectInstantAnswer("what is typescript?");
  assert.equal(nonCalc, null);
});

test("Query: detectInstantAnswer converts distance, temp, and weight units", () => {
  const dist = detectInstantAnswer("10 km to miles");
  assert.ok(dist);
  assert.equal(dist?.answer, "6.21 miles");

  const temp = detectInstantAnswer("100 c to f");
  assert.ok(temp);
  assert.equal(temp?.answer, "212.0 °F");

  const weight = detectInstantAnswer("10 kg to lbs");
  assert.ok(weight);
  assert.equal(weight?.answer, "22.05 lbs");
});
