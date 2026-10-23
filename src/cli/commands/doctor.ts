import { SearchEngine } from "../../core/engine.js";
import { formatDoctorReport } from "../formatters.js";
import { loadConfig } from "../../hosting/config.js";

export async function runDoctorCommand(json = false): Promise<void> {
  const config = loadConfig();
  const engine = new SearchEngine(config);

  process.stderr.write("Checking provider health and connectivity...\n");
  const statuses = await engine.checkHealth();

  if (json) {
    process.stdout.write(JSON.stringify({ config, providers: statuses }, null, 2) + "\n");
    return;
  }

  const report = formatDoctorReport(statuses, config);
  process.stdout.write(report + "\n");
}
