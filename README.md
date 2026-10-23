<div align="center">

```
╦ ╦╔═╗╔╗╔╔╦╗╔═╗╦═╗
║║║╠═╣║║║ ║║║╣ ╠╦╝
╚╩╝╩ ╩╝╚╝═╩╝╚═╝╩╚═
```

# Wander
### Fast, Open-Source Search Engine for Humans, Terminals & AI Agents

[![CI](https://github.com/ItzPhantomm/wander/actions/workflows/ci.yml/badge.svg)](https://github.com/ItzPhantomm/wander/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/Node.js-%3E%3D20.0.0-brightgreen.svg)](https://nodejs.org)
[![MCP Native](https://img.shields.io/badge/MCP-Compatible-purple.svg)](https://modelcontextprotocol.io)
[![Zero Keys Required](https://img.shields.io/badge/API%20Keys-Zero%20Required-success.svg)](#-zero-paid-apis-or-subscriptions)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

<p align="center">
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-why-wander">Why Wander</a> •
  <a href="#-interactive-terminal-ui-tui">Terminal UI</a> •
  <a href="#-query-operators--instant-answers">Query Syntax</a> •
  <a href="#-cli-power-tools">CLI Commands</a> •
  <a href="#-ai--harness-integration-mcp">AI Integration</a> •
  <a href="#-security-architecture">Security</a>
</p>

</div>

---

**Wander** is a lightning-fast, privacy-first, zero-subscription search engine built from the ground up for modern developers, terminal power-users, and autonomous AI harnesses (Claude Code, Antigravity, Cursor, Codex).

It fuses search results from distributed free sources using **Reciprocal Rank Fusion (RRF)**, presents them in an ultra-clean, spacious interactive TUI or scriptable CLI, and exposes a clean **Model Context Protocol (MCP)** stdio server so your AI tools can search the web without costly API bills.

---

## ⚡ Highlights

- 🆓 **100% Free & Open-Source**: Zero mandatory subscriptions, zero credit cards, zero proprietary search API keys.
- 💻 **Dual Hosting Modes**:
  - **Local Mode**: Runs entirely in-process on your machine with offline-first SQLite result caching.
  - **Cloudflare Mode**: 1-click serverless edge deployment to Cloudflare Workers via Wrangler (100,000 reqs/day on free tier).
- 🖥️ **Spacious, Focused Terminal UI**: Elegant, distraction-free search interface with full-width cards, live type-ahead autocomplete, category tabs (`[1..4]` or `[t]`), full-screen distraction-free reader mode (`[r]`), search history navigation (`[↑/↓]`), and instant clipboard copying (`[c]`).
- ⚡ **Advanced Query Operators**: Filter domains (`site:github.com`), categories (`category:code`), exact phrases (`"search terms"`), and excluded words (`-word`).
- 🧮 **Instant Answers**: Built-in instant arithmetic evaluation (`25 * 4 + 10`) and metric/imperial unit conversions (`50 km to miles`, `100 F to C`, `75 kg to lbs`).
- 🤖 **Universal AI Connector**: Auto-injects Wander into Google Antigravity, Claude Code, Cursor, and Codex with a single command (`wander connect`).
- 🛡️ **Hardened Security**: Strict SSRF IP blocking, redirect validation, terminal ANSI escape neutralization, and AI prompt injection fencing.

---

## 🥊 Why Wander?

Most AI search APIs (Tavily, Exa, Brave Search API) charge $0.005–$0.02 per query and lock you into metered tiers. Free web scrapers constantly break or trigger CAPTCHAs. 

Wander solves this by orchestrating a resilient mesh of public sources, applying deduplication and rank fusion, and giving you both a human-first TUI and a machine-first MCP server.

| Feature | 🌐 Wander | 🔍 Tavily / Exa | 🦁 Brave Search API | 🦆 Raw DDG Scraper |
|---|:---:|:---:|:---:|:---:|
| **Cost** | **Free (MIT)** | $20–$100+/mo | Pay-per-query | Free |
| **API Keys Required** | **None** | Yes | Yes | None |
| **Interactive Terminal TUI** | **Yes (Full-Width + Reader)** | ❌ No | ❌ No | ❌ No |
| **Offline-First SQLite Cache** | **Yes** | ❌ No (SaaS) | ❌ No (SaaS) | ❌ No |
| **Multi-Provider Consensus (RRF)** | **Yes (7+ Engines)** | Single Backend | Single Backend | Single |
| **Instant Answers & Math** | **Yes** | ❌ No | Partial | Partial |
| **Model Context Protocol (MCP)** | **Native (Stdio)** | Third-Party Wrapper | Third-Party Wrapper | ❌ No |
| **Distraction-Free Reader Mode** | **Yes (`wander read`)** | Raw Text Only | ❌ No | ❌ No |
| **Prompt Injection Protection** | **Fenced XML Sandboxing** | Cloud-dependent | ❌ No | ❌ No |
| **Self-Hostable Edge Backend** | **Cloudflare Workers** | ❌ Proprietary | ❌ Proprietary | ❌ No |

---

## 🚀 Quick Start

### Global Installation

```bash
# Clone the repository
git clone https://github.com/ItzPhantomm/wander.git
cd wander

# Install dependencies and compile
npm install
npm run build

# Link globally to system PATH
npm link
```

Verify your setup:
```bash
wander --version
wander doctor
```

---

## 🖥️ Interactive Terminal UI (TUI)

Launch the focused, spacious interactive search terminal by running `wander` with no arguments:

```bash
wander
```

```
 🌐 WANDER  Open-Source Search for Humans & AI                        [LOCAL]  
  Categories: [1 ALL]  [2 TECH]  [3 CODE]  [4 SCIENCE]  
  ╭──────────────────────────────────────────────────────────────────────────╮
  │ › rust async patterns                                                  █ │
  ╰──────────────────────────────────────────────────────────────────────────╯
  ▶ 1. Async Programming in Rust - Official Docs  [DuckDuckGo] (score: 0.82)
     https://rust-lang.github.io/async-book/
     Asynchronous programming in Rust enables high-throughput concurrent I/O
     without thread overhead using async/await and executor runtimes.
     ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
    2. Tokio - An Asynchronous Runtime for the Rust Language  [GitHub]
     https://github.com/tokio-rs/tokio
     A runtime for writing reliable, asynchronous, and slim applications...
```

### Keyboard Shortcuts
| Shortcut | Action |
|---|---|
| `[Enter]` | Open selected result in browser (or execute search query in search box) |
| `[↑] / [↓]` | Navigate search query history (in search box) or browse search results |
| `[Tab]` | Pick autocomplete suggestion, or move focus from Search Box to Results |
| `[r]` / `[Space]` | **Distraction-Free Reader Mode**: Read full article text directly in terminal |
| `[t]` | Cycle search category tabs (`All` → `Tech` → `Code` → `Science`) |
| `[1] .. [4]` | Instant direct switch to Category Tab |
| `[c]` | Copy selected URL to system clipboard |
| `[e]` | Export current search results to `wander-results.json` |
| `[m]` | Export current search results as Markdown summary |
| `[/]` or `[s]` | Quick-focus search input |
| `[q]` or `[Esc]` | Exit Wander cleanly (or return from Reader Mode) |

---

## ⚡ Query Operators & Instant Answers

### Search Operators
Wander parses advanced search syntax natively:

- **Site Restriction**: `site:github.com` or `site:docs.rs`
  ```bash
  wander search "memory allocator site:github.com"
  ```
- **Category Filter**: `category:code`, `category:tech`, or `category:science`
  ```bash
  wander search "quantum computing category:science"
  ```
- **Exact Phrase Matching**: `"exact phrase"`
  ```bash
  wander search '"zero-cost abstractions" rust'
  ```
- **Term Exclusion**: `-word`
  ```bash
  wander search "python -snake"
  ```

### Instant Answer Engine
Ask calculations or conversions directly — Wander resolves them without hitting the web:
- **Calculations**: `wander search "25 * 4 + 10"` → `★ Calculation: 110`
- **Unit Conversions**:
  - Distance: `wander search "50 km to miles"` → `31.07 miles`
  - Temperature: `wander search "100 F to C"` → `37.78 °C`
  - Weight: `wander search "75 kg to lbs"` → `165.35 lbs`

---

## 💻 CLI Power Tools

Wander provides a full suite of scriptable, UNIX-friendly commands:

### 1. Basic & Formatted Search
```bash
# Standard search
wander search "PostgreSQL indexing best practices" --limit 5

# Output clean Markdown summary (ideal for LLM feeds or documentation)
wander search "Distributed SQLite" --md

# Output machine-readable JSON for jq and shell pipelines
wander search "Linux eBPF tracing" --json | jq '.[0].title'
```

### 2. Distraction-Free Terminal Reader
Strip paywalls, popups, and JavaScript clutter to read any article directly in the terminal:
```bash
wander read "https://en.wikipedia.org/wiki/Search_engine"
```

### 3. Autocomplete Suggestions
Fast type-ahead suggestions powered by Wikipedia OpenSearch:
```bash
wander suggest "typescript"
```

### 4. Search Query History
Inspect or reset your local search query history:
```bash
wander history
wander history --clear
```

### 5. Parallel Multi-Facet Search
Deconstructs complex topics into parallel query vectors to capture broad consensus:
```bash
wander parallel "Autonomous AI agent communication protocols" --limit 10
```

### 6. Autonomous Deep Research
Runs query expansion, fetches primary pages, extracts core insights, and compiles an executive brief with citations:
```bash
wander research "CRDT algorithms in real-time collaborative text editors"
```

### 7. Safe Webpage Content Fetcher
Fetches any URL with SSRF protection, strips ads/trackers, and returns clean Markdown:
```bash
wander fetch "https://en.wikipedia.org/wiki/Reciprocal_rank_fusion" --max-chars 10000
```

### 8. Diagnostics & Provider Health Checks
```bash
wander doctor
```

---

## 🤖 AI & Harness Integration (MCP)

Wander includes an enterprise-grade **Model Context Protocol (MCP)** stdio server. AI agents can search the web and inspect pages directly inside your IDE or agent harness.

### 🪄 1-Click Auto Connect

Run Wander's automatic harness connector:
```bash
# Automatically detects and configures all installed AI harnesses
wander connect
```

Or target a specific environment:
```bash
wander connect antigravity   # Google Antigravity CLI (~/.gemini/config/mcp_config.json)
wander connect claude        # Claude Code & Desktop (~/.claude.json)
wander connect cursor        # Cursor IDE (~/.cursor/mcp.json)
wander connect codex         # OpenAI Codex CLI (~/.codex/config.json)
```

### Manual Configuration

#### Claude Desktop & Claude Code
Add to `~/.claude/claude_desktop_config.json` or your project `.mcp.json`:
```json
{
  "mcpServers": {
    "wander": {
      "command": "wander",
      "args": ["mcp"]
    }
  }
}
```

#### Cursor IDE
In **Cursor Settings > Features > MCP > Add New MCP Server**:
- **Name**: `wander`
- **Type**: `command`
- **Command**: `wander mcp`

### Exposed AI Tools

| MCP Tool | Functionality |
|---|---|
| `wander_search` | Multi-engine ranked search with query syntax and consensus scoring |
| `wander_parallel_search` | Multifaceted parallel query expansion across diverse angles |
| `wander_fetch` | SSRF-safe page retriever and clean Markdown extractor |
| `wander_research` | Autonomous research engine returning synthesized briefs and cited primary sources |
| `wander_code_search` | Developer search across GitHub repositories, issues, and discussions |

> **Clean Stdio Guarantee**: Diagnostics and logs are strictly redirected to `stderr`. The `stdout` stream remains 100% compliant JSON-RPC 2.0 at all times.

---

## 🛠️ Hosting Modes & Deployment

On the first launch of `wander`, an interactive wizard lets you pick your backend:

### 1. Local Mode (Default)
- Runs locally in-process or as a background service.
- Requires no cloud accounts or credentials.
- Stores cache and history in `~/.cache/wander/`.

### 2. Cloudflare Serverless Mode
- Deploys the search backend to Cloudflare's global edge network using Wrangler.
- Handles up to 100,000 requests/day on Cloudflare's free plan.
- Deploy in one command:
  ```bash
  wander deploy
  ```

### Switch Hosting Anytime
```bash
# Switch to local mode
wander config --mode local

# Switch to Cloudflare Worker
wander config --mode cloudflare --worker-url https://wander.yoursubdomain.workers.dev
```

*Safe Switch Guarantee*: If a new backend fails health checks, Wander preserves your active working configuration and rolls back safely.

---

## 🛡️ Security Architecture

Wander treats all internet data as untrusted:

1. **SSRF Filtering (`src/core/security.ts`)**:
   - Blocks private IPv4 blocks (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `127.0.0.0/8`, `169.254.0.0/16`).
   - Blocks cloud metadata endpoints (`169.254.169.254`, `metadata.google.internal`).
   - Blocks unique local IPv6 (`fc00::/7`, `fe80::/10`, `::1`).
   - Enforces `http:` and `https:` whitelist and validates every hop during HTTP redirects.
2. **Terminal ANSI Neutralization**:
   - Strips malicious escape codes (`\x1b[...]`) and unprintable control characters from snippets before rendering in your terminal.
3. **Prompt Injection Sandboxing**:
   - MCP search results and webpage content are wrapped inside isolated XML delimiters:
     ```xml
     <untrusted_web_content source="...">
       ...
     </untrusted_web_content>
     ```
   - Malicious embedded closing tags (`</untrusted_web_content>`) are sanitized to neutralize boundary jailbreaks.

---

## 📊 Supported Search Providers

All included providers operate without mandatory API keys:

| Engine | Type | Strengths |
|---|---|---|
| **DuckDuckGo** | Web | General web coverage, instant privacy fallback |
| **Wikipedia** | Encyclopedia | High-authority factual definitions & overviews |
| **Hacker News** | Tech | Software engineering discussions & developer insights |
| **GitHub** | Code | Open-source repositories, libraries & code snippets |
| **arXiv** | Science | Academic papers, AI research & scientific preprints |
| **SearXNG** | Meta-Search | Distributed decentralized aggregation |
| **Crossref** | Science | Academic publications & scholarly DOI metadata |

---

## 🧪 Testing

Wander has an automated test suite covering all security filters, query syntax operators, instant answer evaluation, ranking fusion, and MCP stdio protocols:

```bash
npm test
```

```
✔ Config: loadConfig returns valid configuration object
✔ Config: switchHosting to local preserves stability
✔ Config: switchHosting to invalid cloudflare worker rolls back safely
✔ Connector: writes MCP configuration for Antigravity, Claude, and Cursor
✔ Deduplication: normalizeUrl strips tracking params, fragments, and trailing slashes
✔ Deduplication: deduplicateResults merges duplicates and boosts consensus score
✔ Engine: instantiates with default providers and handles searches
✔ Engine: checkHealth returns status for registered providers
✔ Extractor: strips scripts, ads, and converts HTML to clean markdown
✔ Extractor: respects maxCharacters limit and indicates truncation
✔ History: records, returns, and clears entries
✔ MCP: stdio server answers initialize, tools/list, and tool execution
✔ Query: parseQuerySyntax parses search operators
✔ Query: detectInstantAnswer solves math calculations
✔ Query: detectInstantAnswer converts distance, temp, and weight units
✔ Ranking: rankAndFuse applies Reciprocal Rank Fusion across providers
✔ Ranking: rankAndFuse dampens excessive domain duplicates for diversity
✔ Security: isBlockedIPv4 blocks private & metadata ranges
✔ Security: isBlockedIPv6 blocks private & link-local ranges
✔ Security: validateUrlForSSRF blocks forbidden protocols and loopback hosts
✔ Security: sanitizeForTerminal strips hazardous escape sequences
✔ Security: wrapUntrustedContent fences web data and neutralizes end tag exploits

ℹ tests 22 | pass 22 | fail 0
```

---

## 🤝 Contributing

Contributions are warmly welcomed! Please read [CONTRIBUTING.md](CONTRIBUTING.md) to get started.

1. Fork the repo (`https://github.com/ItzPhantomm/wander/fork`)
2. Create your feature branch (`git checkout -b feat/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feat/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for details.

<div align="center">
  <b>Built for humans who love the terminal & AI agents that need truth.</b>
</div>
