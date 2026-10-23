import { SearchEngine } from "../../core/engine.js";
import { formatResultList } from "../formatters.js";
import { loadConfig } from "../../hosting/config.js";

export interface ParallelCliArgs {
  query: string;
  limit?: number;
  json?: boolean;
}

export async function runParallelCommand(args: ParallelCliArgs): Promise<void> {
  const config = loadConfig();
  const engine = new SearchEngine(config);

  const results = await engine.parallelSearch(args.query, {
    limit: args.limit ?? config.search.maxResults
  });

  const isJson = args.json || !process.stdout.isTTY;
  const output = formatResultList(results, isJson);
  process.stdout.write(output + "\n");
}
