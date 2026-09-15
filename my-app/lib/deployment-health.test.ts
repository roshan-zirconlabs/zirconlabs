import test from "node:test";
import assert from "node:assert/strict";
import { checkDeploymentConfig, checkDatabase } from "./deployment-health";

const env = {
  DATABASE_URL: "postgresql://user:secret@localhost:5432/db",
  AUTH_SECRET: "a".repeat(32), GOOGLE_CLIENT_ID: "example.apps.googleusercontent.com",
  GOOGLE_CLIENT_SECRET: "secret", ENCRYPTION_KEY: "a".repeat(64),
};

test("health detects conflicting canonical auth hosts without exposing secrets", () => {
  const result = checkDeploymentConfig({ ...env, AUTH_URL: "https://zirconlabs.org", NEXTAUTH_URL: "https://www.zirconlabs.org" }, "https://www.zirconlabs.org/api/health");
  assert.ok(result.issues.some(i => i.code === "AUTH_ORIGIN_MISMATCH"));
  assert.ok(result.issues.some(i => i.code === "AUTH_URL_CONFLICT"));
  assert.equal(JSON.stringify(result).includes("user:secret"), false);
});

test("direct Supabase connections produce a Vercel networking diagnostic", () => {
  const result = checkDeploymentConfig({ ...env, VERCEL: "1", DATABASE_URL: "postgresql://postgres:secret@db.project.supabase.co:5432/postgres" }, "https://www.zirconlabs.org/api/health");
  assert.ok(result.issues.some(i => i.code === "SUPABASE_DIRECT_CONNECTION"));
});

test("database failure cannot be reported as configured or expose a raw adapter error", async () => {
  const result = await checkDatabase(async () => { throw Object.assign(new Error("postgres://secret:password@host"), { code: "P1001" }); });
  assert.equal(result.status, "unavailable");
  assert.equal(result.code, "DATABASE_UNREACHABLE");
  assert.equal(JSON.stringify(result).includes("password"), false);
});

test("schema failures are distinguished from connectivity failures", async () => {
  assert.equal((await checkDatabase(async () => { throw { code: "P2022" }; })).code, "DATABASE_SCHEMA_MISMATCH");
  assert.equal((await checkDatabase(async () => {})).status, "ok");
});

test("a deployment without a callback secret or reachable origin is not reported healthy", () => {
  const base = {
    DATABASE_URL: "postgresql://u:p@host:5432/db",
    AUTH_SECRET: "x".repeat(40),
    GOOGLE_CLIENT_ID: "id",
    GOOGLE_CLIENT_SECRET: "secret",
    ENCRYPTION_KEY: "a".repeat(64),
    AUTH_URL: "https://www.zirconlabs.org",
    ZLABS_INGEST_SECRET: "y".repeat(30),
    KEEPERHUB_API_KEY: "kh_live",
  };
  const ok = checkDeploymentConfig(base, "https://www.zirconlabs.org/api/health");
  assert.deepEqual(ok.missing, []);
  assert.equal(ok.keeperhubManaged, true);
  assert.equal(ok.issues.length, 0);

  // A short secret cannot derive bot tokens, so it counts as missing.
  const weak = checkDeploymentConfig({ ...base, ZLABS_INGEST_SECRET: "tooshort" }, "https://www.zirconlabs.org/api/health");
  assert.ok(weak.missing.includes("ZLABS_INGEST_SECRET"));

  // localhost is unreachable from KeeperHub's schedulers.
  const local = checkDeploymentConfig({ ...base, AUTH_URL: "http://localhost:3000", ZLABS_PUBLIC_URL: "http://localhost:3000" }, "http://localhost:3000/api/health");
  assert.ok(local.issues.some(i => i.code === "CALLBACK_ORIGIN_UNREACHABLE"));

  // Without a platform key users must bring their own organization.
  const byo = checkDeploymentConfig({ ...base, KEEPERHUB_API_KEY: "" }, "https://www.zirconlabs.org/api/health");
  assert.equal(byo.keeperhubManaged, false);
  assert.ok(byo.issues.some(i => i.code === "KEEPERHUB_NOT_MANAGED"));
});
