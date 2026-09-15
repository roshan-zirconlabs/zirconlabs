import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./prisma";

declare module "next-auth" {
  interface Session {
    user: { id: string; email?: string | null; name?: string | null; image?: string | null };
  }
}

// Email alone is not proof of identity. Accounts here own automation credentials.
// Google is the only OAuth provider and signIn below additionally requires its
// verified-email claim. Enabling linking here lets users who were created by the
// former email/demo flow attach their real Google identity without allowing an
// unverified provider to claim an existing workspace.
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? [Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true,
    })]
    : [],
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  callbacks: {
    signIn({ account, profile }) {
      return account?.provider === "google" && profile?.email_verified === true;
    },
    async jwt({ token, user }) {
      if (user) { token.userId = user.id; token.authVersion = 2; }
      return token.authVersion === 2 ? token : null;
    },
    async session({ session, token }) {
      // Legacy email-only sessions must not retain access after this upgrade.
      session.user.id = typeof token.userId === "string" ? token.userId : "";
      return session;
    },
  },
  pages: { signIn: "/auth/sign-in", error: "/auth/sign-in" },
});
