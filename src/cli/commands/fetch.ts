import { SearchEngine } from "../../core/engine.js";
import { formatFetchedContent } from "../formatters.js";
import { loadConfig } from "../../hosting/config.js";

export interface FetchCliArgs {
  url: string;
  maxChars?: number;
  json?: boolean;
}

export async function runFetchCommand(args: FetchCliArgs): Promise<void> {
  const config = loadConfig();
  const engine = new SearchEngine(config);

  const content = await engine.fetchPage(args.url, args.maxChars ?? 50000);

  const isJson = args.json || !process.stdout.isTTY;
  const output = formatFetchedContent(content, isJson);
  process.stdout.write(output + "\n");
}
