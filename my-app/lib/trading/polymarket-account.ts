import { getAddress, isAddress } from "viem";

/**
 * Legacy account metadata parser for imported profiles. New users are
 * provisioned through the managed-wallet flow and do not choose a signature
 * type in the UI.
 */
export const POLYMARKET_SIGNATURE_TYPES = {
  EOA: 0,
  POLY_PROXY: 1,
  POLY_GNOSIS_SAFE: 2,
  POLY_1271: 3,
} as const;

export type PolymarketSignatureType =
  (typeof POLYMARKET_SIGNATURE_TYPES)[keyof typeof POLYMARKET_SIGNATURE_TYPES];

export type PolymarketCustody = "self-custodied" | "keeperhub-turnkey";

export type PolymarketAccount = {
  signatureType: PolymarketSignatureType;
  /** Address that owns the funds used by the CLOB account. */
  funderAddress: string;
  /** Address that signs CLOB authentication/order payloads. */
  signerAddress: string;
  custody: PolymarketCustody;
};

type AccountInput = {
  signatureType?: unknown;
  funderAddress?: unknown;
  signerAddress?: unknown;
  custody?: unknown;
  [key: string]: unknown;
};

type ValidationResult =
  | { ok: true; value: PolymarketAccount }
  | { ok: false; error: string };

const signatureTypeNames: Record<string, PolymarketSignatureType> = {
  EOA: POLYMARKET_SIGNATURE_TYPES.EOA,
  POLY_PROXY: POLYMARKET_SIGNATURE_TYPES.POLY_PROXY,
  POLY_GNOSIS_SAFE: POLYMARKET_SIGNATURE_TYPES.POLY_GNOSIS_SAFE,
  POLY_1271: POLYMARKET_SIGNATURE_TYPES.POLY_1271,
};

const secretFieldPattern =
  /(?:private.?key|mnemonic|seed.?phrase|secret|passphrase)/i;

export function parsePolymarketSignatureType(
  value: unknown,
): PolymarketSignatureType | null {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value >= 0 && value <= 3 ? (value as PolymarketSignatureType) : null;
  }
  if (typeof value !== "string") return null;

  const normalized = value.trim().toUpperCase();
  if (normalized in signatureTypeNames) return signatureTypeNames[normalized];
  if (/^[0-3]$/.test(normalized)) return Number(normalized) as PolymarketSignatureType;
  return null;
}

function normalizeAddress(value: unknown): string | null {
  if (typeof value !== "string" || !isAddress(value)) return null;
  return getAddress(value);
}

/**
 * Validate imported account metadata without ever accepting private key
 * material. This is retained for migration tooling, not new onboarding.
 */
export function validatePolymarketAccount(input: unknown): ValidationResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "A Polymarket account configuration is required." };
  }

  const raw = input as AccountInput;
  if (Object.keys(raw).some((key) => secretFieldPattern.test(key))) {
    return {
      ok: false,
      error: "Private key, mnemonic, seed phrase, or secret material must not be stored.",
    };
  }

  const signatureType = parsePolymarketSignatureType(raw.signatureType);
  if (signatureType === null) {
    return { ok: false, error: "Choose a supported Polymarket account type." };
  }

  const funderAddress = normalizeAddress(raw.funderAddress);
  if (!funderAddress) {
    return { ok: false, error: "A valid Polymarket funder address is required." };
  }

  const signerAddress = normalizeAddress(raw.signerAddress);
  if (!signerAddress) {
    return { ok: false, error: "A valid signer address is required." };
  }

  if (signatureType === POLYMARKET_SIGNATURE_TYPES.EOA && funderAddress !== signerAddress) {
    return { ok: false, error: "EOA funder and signer addresses must match." };
  }

  if (signatureType === POLYMARKET_SIGNATURE_TYPES.POLY_1271 && funderAddress === signerAddress) {
    return {
      ok: false,
      error: "A type-3 deposit wallet requires a separate owner or session signer address.",
    };
  }

  if (raw.custody !== "self-custodied" && raw.custody !== "keeperhub-turnkey") {
    return { ok: false, error: "Choose a supported signer custody mode." };
  }

  return {
    ok: true,
    value: { signatureType, funderAddress, signerAddress, custody: raw.custody },
  };
}

/** Retained for migration tests; live execution uses the managed wallet adapter. */
export function canUseInstalledClobClient(
  signatureType: PolymarketSignatureType,
): boolean {
  return signatureType !== POLYMARKET_SIGNATURE_TYPES.POLY_1271;
}
