import { runSetupWizard } from "../../hosting/wizard.js";

export async function runSetupCommand(): Promise<void> {
  await runSetupWizard(true);
}
