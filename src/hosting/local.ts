import http from "node:http";
import { SearchEngine } from "../core/engine.js";
import { WanderConfig } from "../core/types.js";
import { logger } from "../utils/logger.js";

export class LocalBackendServer {
  private engine: SearchEngine;
  private server: http.Server | null = null;
  private config: WanderConfig;

  constructor(config: WanderConfig) {
    this.config = config;
    this.engine = new SearchEngine(config);
  }

  getEngine(): SearchEngine {
    return this.engine;
  }

  start(port = 8448, host = "127.0.0.1"): Promise<number> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer(async (req, res) => {
        // Enable CORS for local dashboards or harnesses
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");

        if (req.method === "OPTIONS") {
          res.writeHead(204);
          res.end();
          return;
        }

        try {
          const parsedUrl = new URL(req.url || "/", `http://${host}:${port}`);
          const pathname = parsedUrl.pathname;

          // Route: Health
          if (pathname === "/api/health" || pathname === "/health") {
            const health = await this.engine.checkHealth();
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
              status: "ok",
              mode: "local",
              uptime: process.uptime(),
              providers: health
            }, null, 2));
            return;
          }

          // Route: Search
          if (pathname === "/api/search") {
            const q = parsedUrl.searchParams.get("q") || "";
            const limit = parseInt(parsedUrl.searchParams.get("limit") || "10", 10);
            const results = await this.engine.search(q, { limit });

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ query: q, count: results.length, results }, null, 2));
            return;
          }

          // Route: Parallel Search
          if (pathname === "/api/parallel") {
            const q = parsedUrl.searchParams.get("q") || "";
            const limit = parseInt(parsedUrl.searchParams.get("limit") || "10", 10);
            const results = await this.engine.parallelSearch(q, { limit });

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ query: q, count: results.length, results }, null, 2));
            return;
          }

          // Route: Fetch
          if (pathname === "/api/fetch") {
            const target = parsedUrl.searchParams.get("url") || "";
            if (!target) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Missing 'url' parameter" }));
              return;
            }
            const fetched = await this.engine.fetchPage(target);
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(fetched, null, 2));
            return;
          }

          // Route: Research
          if (pathname === "/api/research") {
            const q = parsedUrl.searchParams.get("q") || "";
            const finding = await this.engine.researchTopic({ query: q });
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(finding, null, 2));
            return;
          }

          // Not found
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Not found", routes: ["/api/health", "/api/search", "/api/parallel", "/api/fetch", "/api/research"] }));
        } catch (err: any) {
          logger.error(`Local server error: ${err.message}`);
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: err.message }));
        }
      });

      this.server.on("error", (err) => {
        reject(err);
      });

      this.server.listen(port, host, () => {
        const address = this.server?.address();
        const actualPort = typeof address === "object" && address ? address.port : port;
        logger.info(`Wander local backend listening on http://${host}:${actualPort}`);
        resolve(actualPort);
      });
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }
}
