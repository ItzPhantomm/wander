import { loadConfig, saveConfig, getConfigPath } from "../../hosting/config.js";
import { switchHosting } from "../../hosting/cloudflare.js";

export interface ConfigCliArgs {
  mode?: "local" | "cloudflare";
  workerUrl?: string;
  deploy?: boolean;
  set?: string; // key=value
  json?: boolean;
}

export async function runConfigCommand(args: ConfigCliArgs): Promise<void> {
  const current = loadConfig();

  // If user passed --mode to switch hosting
  if (args.mode) {
    console.log(`> Switching hosting mode to '${args.mode}'...`);
    const result = await switchHosting(args.mode, {
      workerUrl: args.workerUrl,
      autoDeploy: args.deploy
    });

    if (result.success) {
      console.log(`✓ ${result.message}`);
    } else {
      console.error(`✗ Error: ${result.message}`);
      process.exitCode = 1;
    }
    return;
  }

  // If user passed --set key=value
  if (args.set) {
    const [key, val] = args.set.split("=");
    if (!key || val === undefined) {
      console.error("Format must be --set <key>=<value> (e.g. --set search.maxResults=20)");
      process.exitCode = 1;
      return;
    }

    if (key === "search.maxResults") {
      current.search.maxResults = parseInt(val, 10);
    } else if (key === "search.timeoutMs") {
      current.search.timeoutMs = parseInt(val, 10);
    } else if (key === "search.searxngInstance") {
      current.search.searxngInstance = val;
    } else if (key === "keys.github") {
      current.keys = { ...current.keys, github: val };
    } else {
      console.error(`Unsupported config key: ${key}`);
      process.exitCode = 1;
      return;
    }

    saveConfig(current);
    console.log(`✓ Updated '${key}' to '${val}' in ${getConfigPath()}`);
    return;
  }

  // Otherwise, display current config
  if (args.json) {
    process.stdout.write(JSON.stringify(current, null, 2) + "\n");
    return;
  }

  console.log("\n================ Wander Configuration ================");
  console.log(`Config path: ${getConfigPath()}`);
  console.log(`Hosting Mode: ${current.hosting.mode.toUpperCase()}`);
  if (current.hosting.mode === "cloudflare") {
    console.log(`  Cloudflare Worker URL: ${current.hosting.cloudflare?.workerUrl || "None"}`);
    console.log(`  Deployed At: ${current.hosting.cloudflare?.deployedAt || "None"}`);
  } else {
    console.log(`  Direct In-Process: ${current.hosting.local?.directMode ? "Enabled" : "Disabled"}`);
    console.log(`  Local Port: ${current.hosting.local?.port || 8448}`);
  }
  console.log(`Default Providers: ${current.search.defaultProviders.join(", ")}`);
  console.log(`Max Results: ${current.search.maxResults}`);
  console.log(`Timeout: ${current.search.timeoutMs}ms`);
  console.log(`Cache TTL: ${current.search.cacheTtlMinutes} minutes`);
  console.log("======================================================\n");
  console.log("To change hosting mode:");
  console.log("  wander config --mode local");
  console.log("  wander config --mode cloudflare --worker-url <url>");
  console.log("  wander config --mode cloudflare --deploy");
}
