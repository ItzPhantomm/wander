import { SearchEngine } from "../../core/engine.js";
import { formatResultList } from "../formatters.js";
import { loadConfig } from "../../hosting/config.js";

export interface SearchCliArgs {
  query: string;
  limit?: number;
  providers?: string;
  json?: boolean;
  noCache?: boolean;
}

export async function runSearchCommand(args: SearchCliArgs): Promise<void> {
  const config = loadConfig();
  const engine = new SearchEngine(config);

  const providerList = args.providers
    ? args.providers.split(",").map(p => p.trim()).filter(Boolean)
    : undefined;

  const results = await engine.search(args.query, {
    limit: args.limit ?? config.search.maxResults,
    providers: providerList,
    useCache: !args.noCache
  });

  const isJson = args.json || !process.stdout.isTTY;
  const output = formatResultList(results, isJson);
  process.stdout.write(output + "\n");
}
