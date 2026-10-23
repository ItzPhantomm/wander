import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool
} from "@modelcontextprotocol/sdk/types.js";
import { SearchEngine } from "../core/engine.js";
import { loadConfig } from "../hosting/config.js";
import { wrapUntrustedContent } from "../core/security.js";
import { logger } from "../utils/logger.js";

const TOOLS: Tool[] = [
  {
    name: "wander_search",
    description: "Search the web across multiple free search providers (DuckDuckGo, Wikipedia, HackerNews, GitHub, arXiv, SearXNG, Crossref) with consensus ranking and deduplication. Does not require API keys.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query string."
        },
        limit: {
          type: "number",
          description: "Maximum number of results to return (default: 10, max: 30)."
        },
        providers: {
          type: "array",
          items: { type: "string" },
          description: "Specific providers to query (e.g. ['duckduckgo', 'wikipedia', 'github', 'arxiv', 'hackernews', 'searxng'])."
        }
      },
      required: ["query"]
    }
  },
  {
    name: "wander_parallel_search",
    description: "Execute parallel multifaceted search across multiple query variations simultaneously to gather diverse perspectives and broad coverage.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The main query or core topic."
        },
        subQueries: {
          type: "array",
          items: { type: "string" },
          description: "Optional list of query variations or specific sub-questions to search simultaneously."
        },
        limit: {
          type: "number",
          description: "Maximum total results to return (default: 15)."
        }
      },
      required: ["query"]
    }
  },
  {
    name: "wander_fetch",
    description: "Safely retrieve a webpage with SSRF protection, private-network blocking, redirect validation, and extract clean readable Markdown for AI analysis.",
    inputSchema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "The target HTTP or HTTPS URL to fetch."
        },
        maxCharacters: {
          type: "number",
          description: "Maximum character length of the extracted markdown (default: 40000)."
        }
      },
      required: ["url"]
    }
  },
  {
    name: "wander_research",
    description: "Deep autonomous research tool that runs multi-query expansion, retrieves high-ranking source pages, extracts takeaways, and returns a cited synthesis.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The research topic or question to investigate."
        },
        maxSources: {
          type: "number",
          description: "Number of primary sources to retrieve and read (default: 6)."
        }
      },
      required: ["query"]
    }
  },
  {
    name: "wander_code_search",
    description: "Search open-source repositories, developer tools, libraries, and technical discussions across GitHub and Hacker News.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The technical query, library name, or code topic."
        },
        limit: {
          type: "number",
          description: "Maximum number of repositories and discussions to return (default: 8)."
        }
      },
      required: ["query"]
    }
  }
];

export async function runMcpServer() {
  // Ensure all diagnostic logs go exclusively to stderr
  logger.setLevel("info");
  logger.info("Starting Wander MCP Server (stdio transport)...");

  const config = loadConfig();
  const engine = new SearchEngine(config);

  const server = new Server(
    {
      name: "wander-search",
      version: "1.0.0"
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );

  // List tools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: TOOLS };
  });

  // Call tool handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    logger.info(`MCP tool invocation: ${name}`);

    try {
      if (name === "wander_search") {
        const query = String(args?.query || "");
        const limit = typeof args?.limit === "number" ? Math.min(args.limit, 30) : 10;
        const providers = Array.isArray(args?.providers) ? args.providers.map(String) : undefined;

        const results = await engine.search(query, { limit, providers });

        const formatted = results.map((r, i) =>
          `[${i + 1}] ${r.title}\nURL: ${r.url}\nSource: ${r.source} | Score: ${r.score}\nSnippet: ${r.snippet}\n`
        ).join("\n---\n");

        return {
          content: [
            {
              type: "text",
              text: wrapUntrustedContent(formatted || "No results found.", "wander_search")
            }
          ]
        };
      }

      if (name === "wander_parallel_search") {
        const query = String(args?.query || "");
        const subQueries = Array.isArray(args?.subQueries) ? args.subQueries.map(String) : undefined;
        const limit = typeof args?.limit === "number" ? args.limit : 15;

        const results = await engine.parallelSearch(query, { subQueries, limit });
        const formatted = results.map((r, i) =>
          `[${i + 1}] ${r.title}\nURL: ${r.url}\nSource: ${r.source} | Score: ${r.score}\nSnippet: ${r.snippet}\n`
        ).join("\n---\n");

        return {
          content: [
            {
              type: "text",
              text: wrapUntrustedContent(formatted || "No results found.", "wander_parallel_search")
            }
          ]
        };
      }

      if (name === "wander_fetch") {
        const url = String(args?.url || "");
        const maxCharacters = typeof args?.maxCharacters === "number" ? args.maxCharacters : 40000;

        const fetched = await engine.fetchPage(url, maxCharacters);
        const header = `# ${fetched.title}\nURL: ${fetched.url}\nFetched At: ${fetched.fetchedAt}\nLength: ${fetched.length} chars\n\n`;

        return {
          content: [
            {
              type: "text",
              text: wrapUntrustedContent(header + fetched.markdown, url)
            }
          ]
        };
      }

      if (name === "wander_research") {
        const query = String(args?.query || "");
        const maxSources = typeof args?.maxSources === "number" ? args.maxSources : 6;

        const finding = await engine.researchTopic({ query, maxSources });

        let out = `## Research Synthesis: ${finding.topic}\n\n`;
        out += `### Summary\n${finding.summary}\n\n`;

        if (finding.keyInsights.length > 0) {
          out += `### Key Insights\n`;
          finding.keyInsights.forEach(ins => {
            out += `- ${ins}\n`;
          });
          out += "\n";
        }

        if (finding.sources.length > 0) {
          out += `### Cited Sources\n`;
          finding.sources.forEach((s, idx) => {
            out += `[${idx + 1}] ${s.title}\nURL: ${s.url}\nKey takeaway: ${s.keyTakeaway || s.snippet}\n\n`;
          });
        }

        return {
          content: [
            {
              type: "text",
              text: wrapUntrustedContent(out, `wander_research:${query}`)
            }
          ]
        };
      }

      if (name === "wander_code_search") {
        const query = String(args?.query || "");
        const limit = typeof args?.limit === "number" ? args.limit : 8;

        const results = await engine.search(query, {
          limit,
          providers: ["github", "hackernews"]
        });

        const formatted = results.map((r, i) =>
          `[${i + 1}] ${r.title}\nURL: ${r.url}\nSource: ${r.source}\nSnippet: ${r.snippet}\n`
        ).join("\n---\n");

        return {
          content: [
            {
              type: "text",
              text: wrapUntrustedContent(formatted || "No code results found.", "wander_code_search")
            }
          ]
        };
      }

      throw new Error(`Unknown MCP tool: ${name}`);
    } catch (err: any) {
      logger.error(`MCP tool error [${name}]: ${err.message}`);
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Tool error: ${err.message}`
          }
        ]
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("Wander MCP server connected and listening via stdio.");
}
