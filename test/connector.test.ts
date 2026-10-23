import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { HarnessConnector } from "../src/hosting/connector.js";

test("Connector: writes MCP configuration for Antigravity, Claude, and Cursor", async () => {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "wander-harness-test-"));
  const connector = new HarnessConnector(tempHome);

  const results = await connector.connectAll();
  assert.equal(results.length, 4);

  // Check Antigravity config
  const antigravityFile = path.join(tempHome, ".gemini", "config", "mcp_config.json");
  assert.ok(fs.existsSync(antigravityFile));
  const agConfig = JSON.parse(fs.readFileSync(antigravityFile, "utf-8"));
  assert.equal(agConfig.mcpServers.wander.command, "wander");

  // Check Claude config
  const claudeFile = path.join(tempHome, ".claude.json");
  assert.ok(fs.existsSync(claudeFile));
  const clConfig = JSON.parse(fs.readFileSync(claudeFile, "utf-8"));
  assert.equal(clConfig.mcpServers.wander.command, "wander");

  // Check Cursor config
  const cursorFile = path.join(tempHome, ".cursor", "mcp.json");
  assert.ok(fs.existsSync(cursorFile));
  const curConfig = JSON.parse(fs.readFileSync(cursorFile, "utf-8"));
  assert.equal(curConfig.mcpServers.wander.command, "wander");

  // Cleanup
  fs.rmSync(tempHome, { recursive: true, force: true });
});
