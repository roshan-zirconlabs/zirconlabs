import { test } from "node:test";
import assert from "node:assert/strict";
import { encrypt, decrypt } from "./encryption";

process.env.ENCRYPTION_KEY = "ab".repeat(32);
test("stored credentials cannot be decrypted by another user", () => {
  const sealed = encrypt("kh_secret", "user-a");
  assert.equal(decrypt(sealed, "user-a"), "kh_secret");
  assert.throws(() => decrypt(sealed, "user-b"));
});
test("tampered credentials are rejected", () => {
  const sealed = encrypt("kh_secret", "user-a");
  assert.throws(() => decrypt(sealed.slice(0, -2) + "00", "user-a"));
});
