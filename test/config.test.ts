import test from "node:test";
import assert from "node:assert/strict";
import { loadConfig, saveConfig, DEFAULT_CONFIG } from "../src/hosting/config.js";
import { switchHosting } from "../src/hosting/cloudflare.js";

test("Config: loadConfig returns valid configuration object", () => {
  const cfg = loadConfig();
  assert.ok(cfg.hosting);
  assert.ok(cfg.search);
  assert.ok(Array.isArray(cfg.search.defaultProviders));
});

test("Config: switchHosting to local preserves stability", async () => {
  const res = await switchHosting("local");
  assert.equal(res.success, true);
  assert.equal(res.config.hosting.mode, "local");
});

test("Config: switchHosting to invalid cloudflare worker rolls back safely", async () => {
  const res = await switchHosting("cloudflare", { workerUrl: "http://127.0.0.1:9999" });
  assert.equal(res.success, false);
  // Verify configuration preserved
  assert.equal(res.config.hosting.mode, "local");
});
