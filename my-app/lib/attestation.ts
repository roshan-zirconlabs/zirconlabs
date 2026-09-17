import "server-only";
import { platformKeeperhubKey } from "./keeperhub-connection";

// A publication is anchored on-chain by a real transaction executed through
// KeeperHub — proof that this strategy's execution runs on KeeperHub, not just
// in our database. Sepolia keeps it funds-free; the marker is a 0-value send.
const CHAIN_ID = 11155111;
const MARKER = "0x000000000000000000000000000000000000dEaD";
const BASE = "https://app.keeperhub.com";

export type Attestation = { txHash: string; link: string; chainId: number };

async function call(path: string, key: string, init: RequestInit): Promise<Record<string, unknown> | null> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  return res.json().catch(() => null);
}

const linkFor = (txHash: string) => `https://sepolia.etherscan.io/tx/${txHash}`;

export async function attestPublication(botId: string): Promise<Attestation | null> {
  const key = platformKeeperhubKey();
  if (!key) return null;

  const post = await call("/api/execute/transfer", key, {
    method: "POST",
    headers: { "Idempotency-Key": `zircon-attest-${botId}` },
    body: JSON.stringify({ chainId: CHAIN_ID, recipientAddress: MARKER, amount: "0" }),
  });
  const executionId = typeof post?.executionId === "string" ? post.executionId : null;
  if (!executionId) return null;

  let txHash = typeof post?.transactionHash === "string" ? post.transactionHash : null;
  for (let i = 0; i < 8 && !txHash; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const status = await call(`/api/execute/${executionId}/status`, key, { method: "GET" });
    if (typeof status?.transactionHash === "string") txHash = status.transactionHash;
    else if (status?.status === "failed") return null;
  }

  return txHash ? { txHash, link: linkFor(txHash), chainId: CHAIN_ID } : null;
}
