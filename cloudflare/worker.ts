import { SearchEngine } from "../src/core/engine.js";

// Global engine instance for worker execution
const engine = new SearchEngine({
  hosting: { mode: "cloudflare" },
  search: {
    defaultProviders: ["duckduckgo", "wikipedia", "hackernews", "github", "arxiv", "searxng", "crossref"],
    timeoutMs: 5000,
    maxResults: 15,
    cacheTtlMinutes: 15
  }
});

export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Content-Type": "application/json"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders, status: 204 });
    }

    try {
      if (pathname === "/" || pathname === "/api") {
        return new Response(JSON.stringify({
          name: "Wander Search Backend (Cloudflare Worker)",
          version: "1.0.0",
          license: "MIT",
          endpoints: [
            "/api/health",
            "/api/search?q=<query>",
            "/api/parallel?q=<query>",
            "/api/fetch?url=<url>",
            "/api/research?q=<query>"
          ]
        }, null, 2), { headers: corsHeaders });
      }

      if (pathname === "/api/health" || pathname === "/health") {
        const health = await engine.checkHealth();
        return new Response(JSON.stringify({
          status: "healthy",
          mode: "cloudflare",
          timestamp: new Date().toISOString(),
          providers: health
        }, null, 2), { headers: corsHeaders });
      }

      if (pathname === "/api/search") {
        const q = url.searchParams.get("q") || "";
        const limit = parseInt(url.searchParams.get("limit") || "10", 10);
        const results = await engine.search(q, { limit });
        return new Response(JSON.stringify({
          query: q,
          count: results.length,
          results
        }, null, 2), { headers: corsHeaders });
      }

      if (pathname === "/api/parallel") {
        const q = url.searchParams.get("q") || "";
        const limit = parseInt(url.searchParams.get("limit") || "10", 10);
        const results = await engine.parallelSearch(q, { limit });
        return new Response(JSON.stringify({
          query: q,
          count: results.length,
          results
        }, null, 2), { headers: corsHeaders });
      }

      if (pathname === "/api/fetch") {
        const target = url.searchParams.get("url");
        if (!target) {
          return new Response(JSON.stringify({ error: "Missing required 'url' parameter" }), {
            status: 400,
            headers: corsHeaders
          });
        }
        const content = await engine.fetchPage(target);
        return new Response(JSON.stringify(content, null, 2), { headers: corsHeaders });
      }

      if (pathname === "/api/research") {
        const q = url.searchParams.get("q") || "";
        const finding = await engine.researchTopic({ query: q });
        return new Response(JSON.stringify(finding, null, 2), { headers: corsHeaders });
      }

      return new Response(JSON.stringify({ error: "Endpoint not found" }), {
        status: 404,
        headers: corsHeaders
      });
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: corsHeaders
      });
    }
  }
};
