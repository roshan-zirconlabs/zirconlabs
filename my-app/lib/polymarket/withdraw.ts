import { z } from "zod";
import { getAddress, isAddress, parseUnits } from "viem";

/**
 * Validation for moving collateral out of a user's trading wallet.
 *
 * This is the one place in the product that sends a user's money somewhere
 * they named, so every check here fails closed: an ambiguous destination or an
 * amount that cannot be represented exactly is refused rather than adjusted.
 */

export const COLLATERAL_DECIMALS = 6;

export class WithdrawError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
    this.name = "WithdrawError";
  }
}

export const withdrawInput = z.object({
  destination: z.string().trim(),
  /** Collateral amount in dollars, or "all" to empty the wallet. */
  amount: z.union([z.number().finite().positive(), z.literal("all")]),
  requestId: z.uuid(),
  confirm: z.literal(true),
}).strict();

export type WithdrawInput = z.infer<typeof withdrawInput>;

const ZERO = "0x0000000000000000000000000000000000000000";

/**
 * Returns the checksummed destination, or throws. A lowercase or mixed-case
 * address is accepted and normalised; anything that is not a valid address, or
 * is the zero address, is refused — those funds would be unrecoverable.
 */
export function assertDestination(value: string, ownAddress: string): `0x${string}` {
  const address = value.trim();
  if (!isAddress(address)) {
    throw new WithdrawError("That is not a valid wallet address. Check it and try again.");
  }
  const checksummed = getAddress(address);
  if (checksummed.toLowerCase() === ZERO) {
    throw new WithdrawError("Funds sent to the zero address can never be recovered.");
  }
  if (checksummed.toLowerCase() === ownAddress.trim().toLowerCase()) {
    throw new WithdrawError("That is this trading wallet's own address, so the transfer would do nothing.");
  }
  return checksummed;
}

/**
 * Resolves the requested amount against the on-chain balance, in base units.
 * "all" empties the wallet; a number must be exactly representable at the
 * collateral's precision so the amount signed is the amount the user saw.
 */
export function resolveAmount(requested: number | "all", balance: string): bigint {
  let available: bigint;
  try {
    available = parseUnits(balance, COLLATERAL_DECIMALS);
  } catch {
    throw new WithdrawError("The trading balance could not be read. Try again shortly.", 502);
  }
  if (available <= BigInt(0)) throw new WithdrawError("This trading wallet has no collateral to withdraw.", 409);
  if (requested === "all") return available;

  const rounded = Number(requested.toFixed(COLLATERAL_DECIMALS));
  if (Math.abs(rounded - requested) > 1e-9) {
    throw new WithdrawError(`Amounts are limited to ${COLLATERAL_DECIMALS} decimal places.`);
  }
  const wanted = parseUnits(rounded.toFixed(COLLATERAL_DECIMALS), COLLATERAL_DECIMALS);
  if (wanted <= BigInt(0)) throw new WithdrawError("Enter an amount greater than zero.");
  if (wanted > available) {
    throw new WithdrawError(`You asked to withdraw more than the ${balance} available in this wallet.`, 409);
  }
  return wanted;
}

/** A prior request must not be replayed with different terms. */
export function assertSameWithdrawal(
  existing: { destination: string; amountUsd: unknown },
  destination: string,
  amountBaseUnits: bigint,
) {
  const sameDestination = existing.destination.toLowerCase() === destination.toLowerCase();
  const sameAmount = parseUnits(Number(existing.amountUsd).toFixed(COLLATERAL_DECIMALS), COLLATERAL_DECIMALS) === amountBaseUnits;
  if (!sameDestination || !sameAmount) {
    throw new WithdrawError("This request reference was already used for a different withdrawal. Start a new one.", 409);
  }
}
