type Environment = Record<string, string | undefined>;
type Issue = { code: string; message: string };

/** Only returns names and corrective guidance; never environment values. */
export function checkDeploymentConfig(env: Environment, requestUrl: string) {
  const required = {
    DATABASE_URL: env.DATABASE_URL,
    AUTH_SECRET: env.AUTH_SECRET || env.NEXTAUTH_SECRET,
    GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET,
    ENCRYPTION_KEY: /^[a-f0-9]{64}$/i.test(env.ENCRYPTION_KEY ?? "") ? "valid" : "",
    // Derives every bot's callback token. Without it a published workflow can
    // never authenticate back into this deployment.
    ZLABS_INGEST_SECRET: (env.ZLABS_INGEST_SECRET ?? "").trim().length >= 24 ? "valid" : "",
  };
  const missing = Object.entries(required).filter(([, v]) => !v?.trim()).map(([k]) => k);
  const issues: Issue[] = [];
  const requestOrigin = new URL(requestUrl).origin;
  let callbackUrl = `${requestOrigin}/api/auth/callback/google`;
  try {
    const configured = env.AUTH_URL || env.NEXTAUTH_URL;
    if (configured) {
      const url = new URL(configured);
      if (!/^https?:$/.test(url.protocol) || url.username || url.password) throw new Error("Invalid auth URL");
      callbackUrl = `${url.origin}/api/auth/callback/google`;
      if (url.origin !== requestOrigin) issues.push({ code: "AUTH_ORIGIN_MISMATCH", message: "AUTH_URL must match the final browser domain after redirects. Register that domain's Google callback and redeploy." });
    }
    if (env.AUTH_URL && env.NEXTAUTH_URL && new URL(env.AUTH_URL).origin !== new URL(env.NEXTAUTH_URL).origin) issues.push({ code: "AUTH_URL_CONFLICT", message: "Remove the legacy NEXTAUTH_URL or make it match AUTH_URL." });
  } catch { issues.push({ code: "AUTH_URL_INVALID", message: "Set AUTH_URL to a valid HTTP(S) application origin." }); }
  try {
    if (env.DATABASE_URL) {
      const db = new URL(env.DATABASE_URL);
      if (!/^postgres(ql)?:$/.test(db.protocol)) throw new Error("Invalid database URL");
      if (env.VERCEL && /^db\.[a-z0-9-]+\.supabase\.co$/i.test(db.hostname)) issues.push({ code: "SUPABASE_DIRECT_CONNECTION", message: "Direct Supabase hosts require IPv6 or the IPv4 add-on. On Vercel use the exact shared transaction-pooler connection string from Supabase Connect." });
    }
  } catch { issues.push({ code: "DATABASE_URL_INVALID", message: "DATABASE_URL must be a PostgreSQL connection URL with reserved password characters percent-encoded." }); }
  // Workflow hosting: a platform key means users never handle a KeeperHub key.
  const keeperhubManaged = (env.KEEPERHUB_API_KEY ?? "").trim().startsWith("kh_");
  if (!keeperhubManaged) {
    issues.push({ code: "KEEPERHUB_NOT_MANAGED", message: "No KEEPERHUB_API_KEY is set, so each user must connect their own KeeperHub organization before any bot can run." });
  }

  // KeeperHub calls these endpoints from the public internet.
  const callbackOrigin = (env.ZLABS_PUBLIC_URL || env.AUTH_URL || env.NEXTAUTH_URL || "").trim();
  try {
    const url = new URL(callbackOrigin);
    if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") throw new Error("insecure");
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
      issues.push({ code: "CALLBACK_ORIGIN_UNREACHABLE", message: "Scheduled workflows call back over the public internet. Set ZLABS_PUBLIC_URL to this deployment's public HTTPS origin." });
    }
  } catch {
    issues.push({ code: "CALLBACK_ORIGIN_INVALID", message: "Set ZLABS_PUBLIC_URL to this deployment's public HTTPS origin so KeeperHub can reach the workflow callbacks." });
  }

  return { missing, issues, callbackUrl, keeperhubManaged, callbackOrigin: callbackOrigin || null };
}

export async function checkDatabase(probe: () => Promise<unknown>) {
  try { await probe(); return { status: "ok", code: null }; }
  catch (error) {
    const e = error as { code?: string; meta?: { code?: string } } | null;
    const codes = [e?.code, e?.meta?.code];
    const schema = codes.some(c => c && ["P2021", "P2022", "42P01", "42703"].includes(c));
    return { status: "unavailable", code: schema ? "DATABASE_SCHEMA_MISMATCH" : "DATABASE_UNREACHABLE" };
  }
}
