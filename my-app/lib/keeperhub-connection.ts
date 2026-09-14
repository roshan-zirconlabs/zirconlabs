import { prisma } from "./prisma";
import { decrypt } from "./encryption";
import { KeeperhubClient } from "./keeperhub";

export async function keeperhubForUser(userId: string) {
  const connection = await prisma.keeperhubConnection.findUnique({ where: { userId } });
  if (!connection) throw new Error("Connect your KeeperHub organization on the Connections page first.");
  return new KeeperhubClient(decrypt(connection.encryptedKey, userId));
}
