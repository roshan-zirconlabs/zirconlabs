import { prisma } from "./prisma";

/** Read no account data, but exercise the deployed adapter and auth schema. */
export async function probeAuthDatabase() {
  await prisma.$queryRaw`SELECT u."id", u."email", u."name", u."image", u."emailVerified",
    u."polymarketAccountType", u."polymarketSignerAddress",
    a."id", a."userId", a."provider", a."providerAccountId", a."type",
    a."access_token", a."refresh_token", a."expires_at", a."id_token",
    a."token_type", a."scope", a."session_state"
    FROM "User" u LEFT JOIN "Account" a ON a."userId" = u."id" WHERE false`;
}
