import { CloudflareManager, switchHosting } from "../../hosting/cloudflare.js";

export async function runDeployCommand(): Promise<void> {
  console.log("🚀 Wander Cloudflare Backend Deployer\n");
  const manager = new CloudflareManager();

  const auth = await manager.checkAuth();
  if (!auth.authenticated) {
    console.error(`✗ Authentication required: ${auth.error}`);
    console.error("Please run 'npx wrangler login' or set CLOUDFLARE_API_TOKEN in your environment.\n");
    process.exitCode = 1;
    return;
  }

  console.log(`✓ Authenticated as: ${auth.accountName}`);
  console.log("> Compiling and deploying worker bundle via Wrangler...");

  const res = await manager.deploy();
  if (res.success && res.workerUrl) {
    console.log(`\n🎉 Successfully deployed!`);
    console.log(`Worker Endpoint: ${res.workerUrl}`);
    const switched = await switchHosting("cloudflare", { workerUrl: res.workerUrl });
    if (switched.success) {
      console.log(`✓ Active hosting mode updated to Cloudflare in configuration.`);
    }
  } else {
    console.error(`\n✗ Deployment failed: ${res.error}`);
    process.exitCode = 1;
  }
}
