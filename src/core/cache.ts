import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class SearchCache {
  private memoryMap = new Map<string, CacheEntry<any>>();
  private db: any = null;
  private defaultTtlMs: number;

  constructor(defaultTtlMinutes = 30) {
    this.defaultTtlMs = defaultTtlMinutes * 60 * 1000;
    this.initSqlite();
  }

  private initSqlite() {
    try {
      // Dynamic import to avoid breaking environments where node:sqlite is not loaded
      // @ts-ignore
      const sqliteModule = (globalThis as any).process?.versions?.node
        ? awaitImportSqlite()
        : null;

      if (sqliteModule?.DatabaseSync) {
        const cacheDir = path.join(os.homedir(), ".cache", "wander");
        try {
          fs.mkdirSync(cacheDir, { recursive: true });
          const dbPath = path.join(cacheDir, "wander_cache.db");
          this.db = new sqliteModule.DatabaseSync(dbPath);
          this.db.exec(`
            CREATE TABLE IF NOT EXISTS wander_cache (
              key TEXT PRIMARY KEY,
              value TEXT,
              expires_at INTEGER
            );
            CREATE INDEX IF NOT EXISTS idx_expires ON wander_cache(expires_at);
          `);
        } catch {
          // If filesystem is not writable, fallback to in-memory SQLite
          this.db = new sqliteModule.DatabaseSync(":memory:");
          this.db.exec(`
            CREATE TABLE wander_cache (
              key TEXT PRIMARY KEY,
              value TEXT,
              expires_at INTEGER
            );
          `);
        }
      }
    } catch {
      // Memory fallback only
      this.db = null;
    }
  }

  get<T>(key: string): T | null {
    const now = Date.now();

    // 1. Try SQLite if available
    if (this.db) {
      try {
        const stmt = this.db.prepare("SELECT value FROM wander_cache WHERE key = ? AND expires_at > ?");
        const row = stmt.get(key, now) as { value: string } | undefined;
        if (row) {
          return JSON.parse(row.value) as T;
        }
        return null;
      } catch {
        // Fall back to memoryMap
      }
    }

    // 2. Try memoryMap
    const mem = this.memoryMap.get(key);
    if (mem && mem.expiresAt > now) {
      return mem.value;
    } else if (mem) {
      this.memoryMap.delete(key);
    }
    return null;
  }

  set<T>(key: string, value: T, ttlMs?: number): void {
    const ttl = ttlMs ?? this.defaultTtlMs;
    const expiresAt = Date.now() + ttl;

    // Set memory map
    this.memoryMap.set(key, { value, expiresAt });

    // Set SQLite if available
    if (this.db) {
      try {
        const stmt = this.db.prepare(`
          INSERT INTO wander_cache (key, value, expires_at)
          VALUES (?, ?, ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value, expires_at = excluded.expires_at
        `);
        stmt.run(key, JSON.stringify(value), expiresAt);
      } catch {}
    }
  }

  clear(): void {
    this.memoryMap.clear();
    if (this.db) {
      try {
        this.db.exec("DELETE FROM wander_cache;");
      } catch {}
    }
  }
}

// Helper to safely load node:sqlite
function awaitImportSqlite(): any {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (process as any).getBuiltinModule ? (process as any).getBuiltinModule("node:sqlite") : null;
  } catch {
    return null;
  }
}
