import { HarnessConnector } from "../../hosting/connector.js";

export interface ConnectCliArgs {
  target?: string;
  json?: boolean;
}

export async function runConnectCommand(args: ConnectCliArgs = {}): Promise<void> {
  const connector = new HarnessConnector();
  const target = args.target?.toLowerCase();

  console.log("🤖 Wander AI Harness Auto-Connector\n");

  if (target === "antigravity" || target === "gemini") {
    const res = await connector.connectAntigravity();
    printResults([res], args.json);
    return;
  }

  if (target === "claude" || target === "claudecode") {
    const res = await connector.connectClaude();
    printResults([res], args.json);
    return;
  }

  if (target === "cursor") {
    const res = await connector.connectCursor();
    printResults([res], args.json);
    return;
  }

  if (target === "codex" || target === "opencode") {
    const res = await connector.connectCodex();
    printResults([res], args.json);
    return;
  }

  // Connect all detected harnesses
  console.log("Discovering and connecting installed AI harnesses and IDEs...");
  const results = await connector.connectAll();
  printResults(results, args.json);
}

function printResults(results: any[], json = false) {
  if (json) {
    process.stdout.write(JSON.stringify(results, null, 2) + "\n");
    return;
  }

  console.log("\nResults:");
  results.forEach(r => {
    const icon = r.status === "connected" || r.status === "updated" ? "✓" : "✗";
    console.log(`  ${icon} ${r.harness}: ${r.status}`);
    console.log(`    Config: ${r.configPath}`);
    if (r.error) console.log(`    Error: ${r.error}`);
  });
  console.log("\n🎉 AI Harness connection complete! Wander is now available as a tool in your AI harness.");
}
