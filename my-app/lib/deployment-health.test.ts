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
