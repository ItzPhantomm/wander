export type HostingMode = "local" | "cloudflare";

export interface SearchResult {
  id: string;
  title: string;
  url: string;
  snippet: string;
  source: string;
  score: number;
  author?: string;
  publishedDate?: string;
  metadata?: Record<string, any>;
}

export interface SearchOptions {
  query?: string;
  limit?: number;
  providers?: string[];
  freshness?: "day" | "week" | "month" | "year" | "all";
  categories?: ("general" | "tech" | "science" | "code")[];
  timeoutMs?: number;
  useCache?: boolean;
}

export interface ParallelSearchOptions extends SearchOptions {
  subQueries?: string[];
  combineRankings?: boolean;
}

export interface ResearchTopic {
  query: string;
  maxSources?: number;
  depth?: "quick" | "deep";
}

export interface ResearchFinding {
  topic: string;
  summary: string;
  sources: {
    title: string;
    url: string;
    snippet: string;
    keyTakeaway?: string;
  }[];
  keyInsights: string[];
}

export interface FetchedContent {
  url: string;
  title: string;
  markdown: string;
  plainText: string;
  byline?: string;
  siteName?: string;
  length: number;
  isTruncated: boolean;
  contentType: string;
  fetchedAt: string;
  securityNotice?: string;
}

export interface ProviderCapability {
  supportsFreshness: boolean;
  supportsCategories: boolean;
  requiresKey: boolean;
  rateLimitPerMin: number;
  category: "general" | "tech" | "science" | "code";
}

export interface ProviderStatus {
  name: string;
  category: string;
  isAvailable: boolean;
  latencyMs?: number;
  lastError?: string;
  requiresKey: boolean;
  hasKey: boolean;
}

export interface WanderConfig {
  version: string;
  hosting: {
    mode: HostingMode;
    cloudflare?: {
      workerUrl?: string;
      accountId?: string;
      zoneId?: string;
      workerName?: string;
      deployedAt?: string;
    };
    local?: {
      port?: number;
      host?: string;
      directMode?: boolean; // Run search engine directly in CLI process without daemon
    };
  };
  search: {
    defaultProviders: string[];
    timeoutMs: number;
    maxResults: number;
    cacheTtlMinutes: number;
    searxngInstance?: string;
  };
  keys?: {
    brave?: string;
    github?: string;
  };
  ai?: {
    enabled: boolean;
    provider?: "openai" | "anthropic" | "ollama" | "groq";
    apiKey?: string;
    baseUrl?: string;
    model?: string;
  };
}
