import { checkDeploymentConfig, checkDatabase } from "../lib/deployment-health";
import { probeAuthDatabase } from "../lib/auth-database-probe";
import { prisma } from "../lib/prisma";

async function main() {
  const origin = process.argv[2] || process.env.AUTH_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
  const config = checkDeploymentConfig(process.env, origin);
  const database = await checkDatabase(probeAuthDatabase);
  console.log(JSON.stringify({ ...config, database }, null, 2));
  if (config.missing.length || config.issues.length || database.status !== "ok") process.exitCode = 1;
  await prisma.$disconnect();
}
main().catch(() => { console.error("Deployment check failed. Check environment format and database connectivity."); process.exitCode = 1; });
