export type LogLevel = "debug" | "info" | "warn" | "error";

class StderrLogger {
  private level: LogLevel = "info";

  setLevel(level: LogLevel) {
    this.level = level;
  }

  private shouldLog(targetLevel: LogLevel): boolean {
    const levels: LogLevel[] = ["debug", "info", "warn", "error"];
    return levels.indexOf(targetLevel) >= levels.indexOf(this.level);
  }

  debug(msg: string, ...args: any[]) {
    if (this.shouldLog("debug")) {
      process.stderr.write(`[DEBUG] ${msg} ${args.length ? JSON.stringify(args) : ""}\n`);
    }
  }

  info(msg: string, ...args: any[]) {
    if (this.shouldLog("info")) {
      process.stderr.write(`[INFO] ${msg} ${args.length ? JSON.stringify(args) : ""}\n`);
    }
  }

  warn(msg: string, ...args: any[]) {
    if (this.shouldLog("warn")) {
      process.stderr.write(`[WARN] ${msg} ${args.length ? JSON.stringify(args) : ""}\n`);
    }
  }

  error(msg: string, ...args: any[]) {
    if (this.shouldLog("error")) {
      process.stderr.write(`[ERROR] ${msg} ${args.length ? JSON.stringify(args) : ""}\n`);
    }
  }
}

export const logger = new StderrLogger();
