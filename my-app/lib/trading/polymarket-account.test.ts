import assert from "node:assert/strict";
import test from "node:test";
import {
  POLYMARKET_SIGNATURE_TYPES,
  canUseInstalledClobClient,
  parsePolymarketSignatureType,
  validatePolymarketAccount,
} from "./polymarket-account";

const addressA = "0x1111111111111111111111111111111111111111";
const addressB = "0x2222222222222222222222222222222222222222";

test("accepts a type-3 deposit wallet with a separate owner signer", () => {
  const result = validatePolymarketAccount({
    signatureType: POLYMARKET_SIGNATURE_TYPES.POLY_1271,
    funderAddress: addressA,
    signerAddress: addressB,
    custody: "self-custodied",
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.signatureType, 3);
    assert.notEqual(result.value.funderAddress, result.value.signerAddress);
  }
});

test("rejects type-3 accounts without an owner signer", () => {
  const result = validatePolymarketAccount({
    signatureType: 3,
    funderAddress: addressA,
    custody: "self-custodied",
  });

  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /signer address/i);
});

test("rejects credentials that contain private-key material", () => {
  const result = validatePolymarketAccount({
    signatureType: 0,
    funderAddress: addressA,
    signerAddress: addressA,
    custody: "self-custodied",
    privateKey: "0xdeadbeef",
  });

  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /private key/i);
});

test("requires EOA signer and funder addresses to match", () => {
  const result = validatePolymarketAccount({
    signatureType: "EOA",
    funderAddress: addressA,
    signerAddress: addressB,
    custody: "self-custodied",
  });

  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /match/i);
});

test("parses supported signature type names and rejects unknown values", () => {
  assert.equal(parsePolymarketSignatureType("POLY_1271"), 3);
  assert.equal(parsePolymarketSignatureType("3"), 3);
  assert.equal(parsePolymarketSignatureType("unknown"), null);
});

test("does not claim the installed CLOB SDK supports type 3", () => {
  assert.equal(canUseInstalledClobClient(0), true);
  assert.equal(canUseInstalledClobClient(2), true);
  assert.equal(canUseInstalledClobClient(3), false);
});
