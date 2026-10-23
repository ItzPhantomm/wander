import { SearchEngine } from "../../core/engine.js";
import { formatResearchFinding } from "../formatters.js";
import { loadConfig } from "../../hosting/config.js";

export interface ResearchCliArgs {
  query: string;
  limit?: number;
  json?: boolean;
}

export async function runResearchCommand(args: ResearchCliArgs): Promise<void> {
  const config = loadConfig();
  const engine = new SearchEngine(config);

  const finding = await engine.researchTopic({
    query: args.query,
    maxSources: args.limit ?? 6
  });

  const isJson = args.json || !process.stdout.isTTY;
  const output = formatResearchFinding(finding, isJson);
  process.stdout.write(output + "\n");
}
