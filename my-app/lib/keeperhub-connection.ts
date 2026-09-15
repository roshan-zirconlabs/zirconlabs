import { prisma } from "./prisma";
import { decrypt } from "./encryption";
import { KeeperhubClient } from "./keeperhub";

export type KeeperhubSource = "user" | "platform";

export class KeeperhubUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KeeperhubUnavailableError";
  }
}

export function platformKeeperhubKey(): string | null {
  const key = process.env.KEEPERHUB_API_KEY?.trim();
  return key && key.startsWith("kh_") ? key : null;
}

export function keeperhubManagedByPlatform(): boolean {
  return platformKeeperhubKey() !== null;
}

/**
 * Returns a KeeperHub client for this user.
 *
 * Most users never see a KeeperHub key: Zircon runs their workflows in the
 * platform organization. A user who connects their own organization key on the
 * Connections page takes precedence, so power users keep their own execution
 * environment and spending controls.
 */
export async function keeperhubForUser(userId: string): Promise<{ client: KeeperhubClient; source: KeeperhubSource }> {
  const connection = await prisma.keeperhubConnection.findUnique({ where: { userId } });
  if (connection) {
    return { client: new KeeperhubClient(decrypt(connection.encryptedKey, userId)), source: "user" };
  }
  const platform = platformKeeperhubKey();
  if (platform) return { client: new KeeperhubClient(platform), source: "platform" };
  throw new KeeperhubUnavailableError(
    "Workflow hosting is not configured on this deployment. Set KEEPERHUB_API_KEY, or connect a KeeperHub organization on the Connections page.",
  );
}

/** Workflow name used in the shared organization, so runs stay attributable. */
export function platformWorkflowName(botName: string, botId: string): string {
  return `${botName.slice(0, 60)} · zircon:${botId}`;
}
