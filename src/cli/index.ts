import { runSearchCommand } from "./commands/search.js";
import { runParallelCommand } from "./commands/parallel.js";
import { runResearchCommand } from "./commands/research.js";
import { runFetchCommand } from "./commands/fetch.js";
import { runConfigCommand } from "./commands/config.js";
import { runDoctorCommand } from "./commands/doctor.js";
import { runSetupCommand } from "./commands/setup.js";
import { runDeployCommand } from "./commands/deploy.js";
import { runMcpCommand } from "./commands/mcp.js";
import { runConnectCommand } from "./commands/connect.js";
import { WanderTUI } from "../tui/app.js";
import { SearchEngine } from "../core/engine.js";
import { loadConfig, hasCompletedSetup } from "../hosting/config.js";
import { runSetupWizard } from "../hosting/wizard.js";

const HELP_TEXT = `
Wander — Fast, open-source search engine for humans, terminals & AI agents.

USAGE:
  wander [command] [options] [query]

COMMANDS:
  (default)            Launch the interactive terminal search UI (TUI)
  search <query>       Perform a ranked search across distributed free providers
  parallel <query>     Run parallel multifaceted search across query variations
  research <query>     Autonomous deep research pipeline with citations
  fetch <url>          Safely retrieve a webpage and extract clean Markdown
  config               View or update hosting mode and engine configuration
  doctor               Run diagnostics, provider latency, and health checks
  setup                Run the first-launch interactive hosting setup wizard
  deploy               Compile and deploy serverless backend to Cloudflare Workers
  mcp                  Launch stdio Model Context Protocol (MCP) server for AI agents
  connect [harness]    Auto-connect Wander to AI harnesses (Antigravity, Claude, Cursor, Codex)

OPTIONS:
  -l, --limit <num>        Maximum number of results to return
  -p, --providers <list>   Comma-separated list of search providers to query
  --json                   Output machine-readable JSON (ideal for pipes & scripts)
  --no-cache               Bypass the local SQLite search cache
  --mode <local|cf>        Set hosting mode in 'config' (local or cloudflare)
  --worker-url <url>       Set Cloudflare Worker endpoint URL
  -h, --help               Display this help guide
  -v, --version            Display Wander version

EXAMPLES:
  wander "Rust async patterns"
  wander search "Linux kernel memory management" --limit 5
  wander parallel "Autonomous AI agents" --json
  wander research "CRDTs in distributed databases"
  wander fetch "https://en.wikipedia.org/wiki/Search_engine"
  wander doctor
  wander mcp
`;

export async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    // Launch TUI or setup wizard if first time
    if (!hasCompletedSetup()) {
      await runSetupWizard(false);
    }
    const config = loadConfig();
    const engine = new SearchEngine(config);
    const tui = new WanderTUI(engine, config);
    tui.start();
    return;
  }

  const first = args[0];

  if (first === "-h" || first === "--help" || first === "help") {
    process.stdout.write(HELP_TEXT.trim() + "\n");
    return;
  }

  if (first === "-v" || first === "--version" || first === "version") {
    process.stdout.write("wander 1.0.0 (Open-Source)\n");
    return;
  }

  // Parse common flags
  const json = args.includes("--json");
  const noCache = args.includes("--no-cache");

  const getArgValue = (flags: string[]): string | undefined => {
    for (const flag of flags) {
      const idx = args.indexOf(flag);
      if (idx !== -1 && idx + 1 < args.length) {
        return args[idx + 1];
      }
    }
    return undefined;
  };

  const limitStr = getArgValue(["-l", "--limit"]);
  const limit = limitStr ? parseInt(limitStr, 10) : undefined;
  const providers = getArgValue(["-p", "--providers"]);

  // Extracts non-flag positional arguments excluding options that consume a value
  const extractQuery = (commandArgs: string[]): string => {
    const valueFlags = new Set(["-l", "--limit", "-p", "--providers", "--max-chars", "--mode", "--worker-url", "--set"]);
    const queryParts: string[] = [];
    for (let i = 0; i < commandArgs.length; i++) {
      const arg = commandArgs[i];
      if (valueFlags.has(arg)) {
        i++; // Skip the flag value as well
        continue;
      }
      if (arg.startsWith("-")) {
        continue; // Skip boolean flag
      }
      queryParts.push(arg);
    }
    return queryParts.join(" ").trim();
  };

  switch (first) {
    case "search": {
      const query = extractQuery(args.slice(1));
      if (!query) {
        console.error("Error: 'wander search' requires a query string. Example: wander search \"Linux kernel\"");
        process.exitCode = 1;
        return;
      }
      await runSearchCommand({ query, limit, providers, json, noCache });
      break;
    }

    case "parallel": {
      const query = extractQuery(args.slice(1));
      if (!query) {
        console.error("Error: 'wander parallel' requires a query string. Example: wander parallel \"Distributed consensus\"");
        process.exitCode = 1;
        return;
      }
      await runParallelCommand({ query, limit, json });
      break;
    }

    case "research": {
      const query = extractQuery(args.slice(1));
      if (!query) {
        console.error("Error: 'wander research' requires a query string. Example: wander research \"Post-quantum cryptography\"");
        process.exitCode = 1;
        return;
      }
      await runResearchCommand({ query, limit, json });
      break;
    }

    case "fetch": {
      const targetUrl = extractQuery(args.slice(1)).split(" ")[0];
      if (!targetUrl) {
        console.error("Error: 'wander fetch' requires a URL. Example: wander fetch https://example.com");
        process.exitCode = 1;
        return;
      }
      const maxCharsStr = getArgValue(["--max-chars"]);
      const maxChars = maxCharsStr ? parseInt(maxCharsStr, 10) : undefined;
      await runFetchCommand({ url: targetUrl, maxChars, json });
      break;
    }

    case "config": {
      const mode = getArgValue(["--mode"]) as "local" | "cloudflare" | undefined;
      const workerUrl = getArgValue(["--worker-url"]);
      const set = getArgValue(["--set"]);
      const deploy = args.includes("--deploy");
      await runConfigCommand({ mode, workerUrl, set, deploy, json });
      break;
    }

    case "doctor": {
      await runDoctorCommand(json);
      break;
    }

    case "setup": {
      await runSetupCommand();
      break;
    }

    case "deploy": {
      await runDeployCommand();
      break;
    }

    case "mcp": {
      await runMcpCommand();
      break;
    }

    case "connect": {
      const target = args.slice(1).find(a => !a.startsWith("-"));
      await runConnectCommand({ target, json });
      break;
    }

    default: {
      // If the first argument does not start with dash, treat as direct search query!
      if (!first.startsWith("-")) {
        const query = extractQuery(args);
        await runSearchCommand({ query, limit, providers, json, noCache });
      } else {
        console.error(`Unknown option: ${first}`);
        process.stdout.write(HELP_TEXT.trim() + "\n");
        process.exitCode = 1;
      }
      break;
    }
  }
}

// Auto-run if executed as script
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("wander") || process.argv[1]?.endsWith("wander.js") || process.argv[1]?.endsWith("cli.js") || process.argv[1]?.endsWith("index.ts")) {
  main().catch((err) => {
    console.error(`Wander fatal error: ${err.message}`);
    process.exit(1);
  });
}
