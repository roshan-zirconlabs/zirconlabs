"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  Info,
  ShieldCheck,
  ExternalLink,
  RefreshCw,
  Wallet,
  X,
  Lock,
} from "lucide-react";
import { ethers } from "ethers";

type CompatibilityCheck = {
  id: string;
  title: string;
  status: "PASSED" | "ACTION_REQUIRED" | "WARNING" | "INFO";
  description: string;
  balance?: string;
  accountType?: string;
};

type CompatibilityData = {
  address: string;
  isEOA: boolean;
  accountType: string;
  polBalance: number;
  totalUsdc: number;
  hasUsdcAllowance: boolean;
  polymarketRegistered: boolean;
  checks: CompatibilityCheck[];
  canPaperTrade: boolean;
  canLiveTrade: boolean;
  recommendation: string;
};

const POLYGON_CHAIN_ID_HEX = "0x89"; // 137 in hex
const POLYMARKET_CTF_EXCHANGE = "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E";
const USDC_BRIDGED_ADDRESS = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";

export default function PolymarketReadinessModal({
  isOpen,
  onClose,
  initialAddress,
}: {
  isOpen: boolean;
  onClose: () => void;
  initialAddress?: string;
}) {
  const [address, setAddress] = useState<string>(initialAddress || "");
  const [data, setData] = useState<CompatibilityData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Auto-detect connected wallet if address is not passed
  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).ethereum && !address) {
      const eth = (window as any).ethereum;
      eth.request({ method: "eth_accounts" }).then((accounts: string[]) => {
        if (accounts && accounts[0]) {
          setAddress(accounts[0]);
        }
      }).catch(() => null);
    }
  }, [address]);

  const runCheck = useCallback(async (addr: string) => {
    if (!addr || !ethers.isAddress(addr)) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/wallet/compatibility?address=${addr}`);
      if (!res.ok) throw new Error("Failed to evaluate account");
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      console.error(err);
      setMessage({ type: "error", text: err.message || "Failed to load account checks" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && address) {
      runCheck(address);
    }
  }, [isOpen, address, runCheck]);

  // Non-custodial 1-click connect via browser wallet
  async function connectWallet() {
    if (typeof window === "undefined" || !(window as any).ethereum) {
      alert("Please install MetaMask, Rabby, or any Web3 wallet extension.");
      return;
    }
    try {
      const accounts = await (window as any).ethereum.request({
        method: "eth_requestAccounts",
      });
      if (accounts[0]) {
        setAddress(accounts[0]);
        runCheck(accounts[0]);
      }
    } catch (err: any) {
      console.error("Wallet connection rejected:", err);
    }
  }

  // Non-custodial: switch network to Polygon
  async function switchToPolygon() {
    if (typeof window === "undefined" || !(window as any).ethereum) return;
    setActionLoading("network");
    try {
      await (window as any).ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: POLYGON_CHAIN_ID_HEX }],
      });
      setMessage({ type: "success", text: "Switched to Polygon Mainnet." });
      if (address) runCheck(address);
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        try {
          await (window as any).ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: POLYGON_CHAIN_ID_HEX,
                chainName: "Polygon Mainnet",
                nativeCurrency: { name: "POL", symbol: "POL", decimals: 18 },
                rpcUrls: ["https://polygon-bor-rpc.publicnode.com"],
                blockExplorerUrls: ["https://polygonscan.com/"],
              },
            ],
          });
          runCheck(address);
        } catch {
          setMessage({ type: "error", text: "Failed to add Polygon network." });
        }
      } else {
        setMessage({ type: "error", text: switchError.message || "Failed to switch network." });
      }
    } finally {
      setActionLoading(null);
    }
  }

  // Non-custodial: approve USDC for Polymarket CTF Exchange
  async function approveCtfExchange() {
    if (typeof window === "undefined" || !(window as any).ethereum) return;
    setActionLoading("ctf_allowance");
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const usdcAbi = ["function approve(address spender, uint256 amount) returns (bool)"];
      const contract = new ethers.Contract(USDC_BRIDGED_ADDRESS, usdcAbi, signer);

      const tx = await contract.approve(POLYMARKET_CTF_EXCHANGE, ethers.MaxUint256);
      setMessage({ type: "success", text: `Approval submitted: ${tx.hash.slice(0, 10)}... Waiting for confirmation...` });
      await tx.wait(1);
      setMessage({ type: "success", text: "Polymarket CTF Exchange successfully approved!" });
      runCheck(address);
    } catch (err: any) {
      console.error(err);
      setMessage({ type: "error", text: err?.message || "Token approval was rejected." });
    } finally {
      setActionLoading(null);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl rounded-2xl border border-purple-100 bg-white shadow-2xl shadow-purple-900/10 flex flex-col max-h-[85vh] my-auto overflow-hidden">
        {/* Modal Header */}
        <div className="shrink-0 flex items-center justify-between border-b border-purple-100 px-5 py-4 bg-gradient-to-r from-purple-50/80 via-white to-pink-50/70">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-pink-500 text-white shadow-xs">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-semibold text-slate-900 flex items-center gap-2">
                Polymarket Compatibility
                <span className="rounded-full bg-purple-100 border border-purple-200 px-2 py-0.5 text-[10px] font-mono text-purple-700 font-semibold">
                  Polygon 137
                </span>
              </h2>
              <p className="text-[11px] text-slate-500">
                Non-custodial pre-flight checks for paper and live trading
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-purple-50 hover:text-slate-700 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 p-4 sm:p-5 space-y-4 overflow-y-auto">
          {/* Security Notice Pill */}
          <div className="flex items-center gap-2.5 rounded-xl border border-purple-200/80 bg-purple-50/60 px-4 py-2.5 text-xs text-purple-950">
            <Lock className="h-4 w-4 shrink-0 text-violet-600" />
            <p>
              <strong>Strictly Non-Custodial:</strong> Zircon Labs never asks for your private key. Approvals are signed directly by your browser wallet.
            </p>
          </div>

          {/* Connected Address Input Bar */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700 flex items-center justify-between">
              <span>Connected Trader EOA / Safe Address:</span>
              <button
                onClick={connectWallet}
                className="text-[11px] text-violet-700 hover:text-violet-800 font-medium flex items-center gap-1"
              >
                <Wallet className="h-3 w-3" />
                Connect Browser Wallet
              </button>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value.trim())}
                placeholder="0x... (Paste Polygon address to inspect)"
                className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-mono text-slate-800 placeholder-slate-400 focus:border-purple-400 focus:bg-white focus:outline-none"
              />
              <button
                onClick={() => runCheck(address)}
                disabled={loading || !address}
                className="flex items-center gap-1.5 rounded-xl border border-purple-200 bg-purple-50 px-3.5 py-2 text-xs font-medium text-purple-700 hover:bg-purple-100 disabled:opacity-50 transition"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                Check
              </button>
            </div>
          </div>

          {message && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${
                message.type === "success"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : "bg-rose-50 border-rose-200 text-rose-800"
              }`}
            >
              {message.type === "success" ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              ) : (
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
              )}
              <span>{message.text}</span>
            </div>
          )}

          {/* Compatibility Checks List */}
          {loading ? (
            <div className="py-10 text-center space-y-3">
              <RefreshCw className="h-7 w-7 text-violet-600 animate-spin mx-auto" />
              <p className="text-xs text-slate-500 font-mono">
                Querying Polygon RPC & Polymarket Data API...
              </p>
            </div>
          ) : data ? (
            <div className="space-y-4">
              {/* Summary Banner */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3.5">
                  <span className="text-[10px] font-semibold text-emerald-800 uppercase tracking-wider">
                    Paper Trading Mode
                  </span>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="flex h-2 w-2 rounded-full bg-emerald-600" />
                    <span className="text-xs sm:text-sm font-bold text-emerald-700">
                      100% Ready (Free)
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-emerald-800/80 leading-relaxed">
                    Uses live Polymarket CLOB book odds. $0 gas or USDC needed.
                  </p>
                </div>

                <div className={`rounded-xl border p-3.5 ${
                  data.canLiveTrade
                    ? "border-emerald-200 bg-emerald-50/50"
                    : "border-amber-200 bg-amber-50/50"
                }`}>
                  <span className={`text-[10px] font-semibold uppercase tracking-wider ${
                    data.canLiveTrade ? "text-emerald-800" : "text-amber-800"
                  }`}>
                    Live On-Chain Trading
                  </span>
                  <div className="mt-1 flex items-center gap-2">
                    <span
                      className={`flex h-2 w-2 rounded-full ${
                        data.canLiveTrade ? "bg-emerald-600" : "bg-amber-500"
                      }`}
                    />
                    <span
                      className={`text-xs sm:text-sm font-bold ${
                        data.canLiveTrade ? "text-emerald-700" : "text-amber-700"
                      }`}
                    >
                      {data.canLiveTrade ? "Ready for Live Execution" : "Setup Required"}
                    </span>
                  </div>
                  <p className={`mt-1 text-[11px] leading-relaxed ${
                    data.canLiveTrade ? "text-emerald-800/80" : "text-amber-800/80"
                  }`}>
                    {data.canLiveTrade
                      ? "Balance & approvals verified on Polygon."
                      : "Deposit gas/USDC and approve CTF below."}
                  </p>
                </div>
              </div>

              {/* Individual Checklist Items */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  6-Point Compatibility Checklist
                </h3>
                <div className="divide-y divide-purple-100/70 rounded-xl border border-purple-100 bg-slate-50/50">
                  {data.checks.map((c) => (
                    <div
                      key={c.id}
                      className="p-3.5 flex items-start justify-between gap-3 text-xs hover:bg-purple-50/40 transition"
                    >
                      <div className="flex items-start gap-2.5">
                        {c.status === "PASSED" ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                        ) : c.status === "ACTION_REQUIRED" ? (
                          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                        ) : (
                          <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-800">{c.title}</span>
                            {c.balance && (
                              <span className="rounded bg-white border border-purple-100 px-1.5 py-0.2 text-[10px] font-mono text-emerald-700 font-medium">
                                {c.balance}
                              </span>
                            )}
                          </div>
                          <p className="text-slate-500 text-[11px] mt-0.5">{c.description}</p>
                        </div>
                      </div>

                      {/* Interactive Action Buttons */}
                      <div className="shrink-0">
                        {c.id === "network" && (
                          <button
                            onClick={switchToPolygon}
                            disabled={actionLoading === "network"}
                            className="rounded-lg border border-purple-200 bg-white px-2.5 py-1 text-[11px] font-medium text-purple-700 hover:bg-purple-50 transition shadow-xs"
                          >
                            {actionLoading === "network" ? "Switching..." : "Switch"}
                          </button>
                        )}
                        {c.id === "ctf_allowance" && c.status === "ACTION_REQUIRED" && (
                          <button
                            onClick={approveCtfExchange}
                            disabled={actionLoading === "ctf_allowance"}
                            className="rounded-lg cosmic-btn-primary px-2.5 py-1 text-[11px] font-semibold text-white shadow-xs transition"
                          >
                            {actionLoading === "ctf_allowance" ? "Approving..." : "Approve USDC"}
                          </button>
                        )}
                        {c.id === "polymarket_profile" && (
                          <a
                            href={`https://polymarket.com/profile/${address}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-violet-700 hover:underline"
                          >
                            Polymarket
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center space-y-2 text-slate-400 text-xs">
              <Wallet className="h-8 w-8 mx-auto text-slate-300" />
              <p>Connect your wallet above or paste any Polygon address to evaluate compatibility.</p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="shrink-0 border-t border-purple-100 px-5 py-3.5 bg-slate-50 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">
            KeeperHub non-custodial execution layer
          </span>
          <button
            onClick={onClose}
            className="rounded-xl bg-slate-900 text-white px-4 py-2 text-xs font-semibold hover:bg-slate-800 transition shadow-xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
