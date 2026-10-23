import test from "node:test";
import assert from "node:assert/strict";
import { addHistoryEntry, getHistoryEntries, clearHistoryEntries } from "../src/core/history.js";

test("History: records, returns, and clears entries", () => {
  clearHistoryEntries();
  assert.equal(getHistoryEntries().length, 0);

  addHistoryEntry("First query");
  addHistoryEntry("Second query");
  addHistoryEntry("First query"); // duplicate moves to front

  const list = getHistoryEntries();
  assert.equal(list.length, 2);
  assert.equal(list[0], "First query");
  assert.equal(list[1], "Second query");

  clearHistoryEntries();
  assert.equal(getHistoryEntries().length, 0);
});
