import { SearchResult, SearchOptions, ProviderCapability, ProviderStatus } from "../core/types.js";

export abstract class BaseProvider {
  abstract readonly name: string;
  abstract readonly displayName: string;
  abstract readonly category: "general" | "tech" | "science" | "code";
  abstract readonly capabilities: ProviderCapability;

  abstract search(query: string, options?: SearchOptions): Promise<SearchResult[]>;

  async healthCheck(): Promise<ProviderStatus> {
    const start = Date.now();
    try {
      const results = await this.search("test", { limit: 1, timeoutMs: 4000 });
      return {
        name: this.name,
        category: this.category,
        isAvailable: true,
        latencyMs: Date.now() - start,
        requiresKey: this.capabilities.requiresKey,
        hasKey: true
      };
    } catch (err: any) {
      return {
        name: this.name,
        category: this.category,
        isAvailable: false,
        latencyMs: Date.now() - start,
        lastError: err.message,
        requiresKey: this.capabilities.requiresKey,
        hasKey: false
      };
    }
  }
}
