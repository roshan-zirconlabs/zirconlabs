import test from "node:test";
import assert from "node:assert/strict";
import { checkDeploymentConfig, checkDatabase } from "./deployment-health";

const env = {
  DATABASE_URL: "postgresql://user:secret@localhost:5432/db",
  AUTH_SECRET: "a".repeat(32), GOOGLE_CLIENT_ID: "example.apps.googleusercontent.com",
  GOOGLE_CLIENT_SECRET: "secret",
};

test("health detects conflicting canonical auth hosts without exposing secrets", () => {
  const result = checkDeploymentConfig({ ...env, AUTH_URL: "https://polytrade.fi", NEXTAUTH_URL: "https://www.polytrade.fi" }, "https://www.polytrade.fi/api/health");
  assert.ok(result.issues.some(i => i.code === "AUTH_ORIGIN_MISMATCH"));
  assert.ok(result.issues.some(i => i.code === "AUTH_URL_CONFLICT"));
  assert.equal(JSON.stringify(result).includes("user:secret"), false);
});

test("direct Supabase connections produce a Vercel networking diagnostic", () => {
  const result = checkDeploymentConfig({ ...env, VERCEL: "1", DATABASE_URL: "postgresql://postgres:secret@db.project.supabase.co:5432/postgres" }, "https://polytrade.fi/api/health");
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

test("a deployment without a bot secret or public origin is not reported healthy", () => {
  const base = {
    DATABASE_URL: "postgresql://u:p@host:5432/db",
    AUTH_SECRET: "x".repeat(40),
    GOOGLE_CLIENT_ID: "id",
    GOOGLE_CLIENT_SECRET: "secret",
    AUTH_URL: "https://polytrade.fi",
    APP_URL: "https://polytrade.fi",
    BOT_SECRET: "y".repeat(30),
  };
  const ok = checkDeploymentConfig(base, "https://polytrade.fi/api/health");
  assert.deepEqual(ok.missing, []);
  assert.equal(ok.issues.length, 0);

  // A short secret cannot derive alert URLs, so it counts as missing.
  const weak = checkDeploymentConfig({ ...base, BOT_SECRET: "tooshort" }, "https://polytrade.fi/api/health");
  assert.ok(weak.missing.includes("BOT_SECRET"));

  // Deployments set up before the rename keep working.
  const legacy = checkDeploymentConfig({ ...base, BOT_SECRET: undefined, ZLABS_INGEST_SECRET: "z".repeat(30) }, "https://polytrade.fi/api/health");
  assert.ok(!legacy.missing.includes("BOT_SECRET"));

  // TradingView cannot reach localhost.
  const local = checkDeploymentConfig({ ...base, AUTH_URL: "http://localhost:3000", APP_URL: "http://localhost:3000" }, "http://localhost:3000/api/health");
  assert.ok(local.issues.some(i => i.code === "PUBLIC_ORIGIN_LOCAL"));
});
