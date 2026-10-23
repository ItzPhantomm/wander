import { getQuerySuggestions } from "../../core/suggestions.js";

export async function runSuggestCommand(prefix: string, json = false): Promise<void> {
  const suggestions = await getQuerySuggestions(prefix, 6);

  if (json) {
    process.stdout.write(JSON.stringify(suggestions, null, 2) + "\n");
    return;
  }

  if (suggestions.length === 0) {
    console.log("No suggestions found.");
    return;
  }

  console.log(`\nSuggestions for "${prefix}":`);
  suggestions.forEach((s, i) => {
    console.log(`  ${i + 1}. \x1b[36m${s}\x1b[0m`);
  });
  console.log("");
}
