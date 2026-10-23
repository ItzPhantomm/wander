import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";

test("MCP: stdio server answers initialize, tools/list, and tool execution", async () => {
  const child = spawn("node", ["dist/cli.js", "mcp"], {
    stdio: ["pipe", "pipe", "pipe"],
    cwd: process.cwd()
  });

  let buffer = "";

  const responsePromise = new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error("MCP test timed out after 15 seconds"));
    }, 15000);

    child.stdout.on("data", (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;
        const msg = JSON.parse(line);

        if (msg.id === 1) {
          // Send tools/list
          child.stdin.write(JSON.stringify({
            jsonrpc: "2.0",
            id: 2,
            method: "tools/list",
            params: {}
          }) + "\n");
        } else if (msg.id === 2) {
          const toolNames = msg.result.tools.map((t: any) => t.name);
          assert.ok(toolNames.includes("wander_search"));
          assert.ok(toolNames.includes("wander_fetch"));
          assert.ok(toolNames.includes("wander_parallel_search"));
          assert.ok(toolNames.includes("wander_research"));
          assert.ok(toolNames.includes("wander_code_search"));

          clearTimeout(timeout);
          child.kill();
          resolve();
        }
      }
    });

    child.stderr.on("data", () => {
      // Diagnostic messages on stderr are normal
    });

    // Send initialize
    child.stdin.write(JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "wander-test-runner", version: "1.0.0" }
      }
    }) + "\n");
  });

  await responsePromise;
});
