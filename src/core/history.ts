import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const HISTORY_FILE = path.join(os.homedir(), ".cache", "wander", "history.json");
const MAX_HISTORY = 100;

export function addHistoryEntry(query: string): void {
  const clean = query.trim();
  if (!clean) return;

  try {
    const list = getHistoryEntries();
    const filtered = list.filter(q => q.toLowerCase() !== clean.toLowerCase());
    filtered.unshift(clean);
    const bounded = filtered.slice(0, MAX_HISTORY);

    fs.mkdirSync(path.dirname(HISTORY_FILE), { recursive: true });
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(bounded, null, 2), "utf-8");
  } catch {}
}

export function getHistoryEntries(): string[] {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const data = fs.readFileSync(HISTORY_FILE, "utf-8");
      const list = JSON.parse(data);
      if (Array.isArray(list)) return list;
    }
  } catch {}
  return [];
}

export function clearHistoryEntries(): void {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      fs.unlinkSync(HISTORY_FILE);
    }
  } catch {}
}
