import { SearchEngine } from "../../core/engine.js";
import { formatResultList } from "../formatters.js";
import { loadConfig } from "../../hosting/config.js";

export interface SearchCliArgs {
  query: string;
  limit?: number;
  providers?: string;
  site?: string;
  json?: boolean;
  markdown?: boolean;
  noCache?: boolean;
}

export async function runSearchCommand(args: SearchCliArgs): Promise<void> {
  const config = loadConfig();
  const engine = new SearchEngine(config);

  const providerList = args.providers
    ? args.providers.split(",").map(p => p.trim()).filter(Boolean)
    : undefined;

  const res = await engine.searchWithResponse(args.query, {
    limit: args.limit ?? config.search.maxResults,
    providers: providerList,
    site: args.site,
    useCache: !args.noCache
  });

  if (args.json) {
    process.stdout.write(JSON.stringify(res, null, 2) + "\n");
    return;
  }

  if (args.markdown) {
    const mdLines: string[] = [`# Search Results for "${args.query}"\n`];
    if (res.instantAnswer) {
      mdLines.push(`> **${res.instantAnswer.title}:** ${res.instantAnswer.answer}\n`);
    }
    res.results.forEach((r, i) => {
      mdLines.push(`### ${i + 1}. [${r.title}](${r.url})\n**Source:** ${r.source} | **Score:** ${r.score}\n\n${r.snippet}\n`);
    });
    process.stdout.write(mdLines.join("\n") + "\n");
    return;
  }

  // Display Instant Answer if present
  if (res.instantAnswer && process.stdout.isTTY) {
    console.log(`\n\x1b[33m\x1b[1m★ ${res.instantAnswer.title}:\x1b[0m \x1b[36m${res.instantAnswer.answer}\x1b[0m ${res.instantAnswer.details ? `\x1b[2m(${res.instantAnswer.details})\x1b[0m` : ""}\n`);
  }

  const isJson = !process.stdout.isTTY;
  const output = formatResultList(res.results, isJson);
  process.stdout.write(output + "\n");
}
