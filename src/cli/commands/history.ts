import { getHistoryEntries, clearHistoryEntries } from "../../core/history.js";

export function runHistoryCommand(clear = false, json = false): void {
  if (clear) {
    clearHistoryEntries();
    console.log("✓ Search history cleared.");
    return;
  }

  const entries = getHistoryEntries();

  if (json) {
    process.stdout.write(JSON.stringify(entries, null, 2) + "\n");
    return;
  }

  if (entries.length === 0) {
    console.log("No search history yet.");
    return;
  }

  console.log(`\nRecent Search History (${entries.length} items):`);
  entries.slice(0, 25).forEach((q, i) => {
    console.log(`  ${(i + 1).toString().padStart(2, " ")}. \x1b[36m${q}\x1b[0m`);
  });
  console.log("\nTo clear history: wander history --clear\n");
}
