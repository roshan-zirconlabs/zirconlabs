"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import type { MarketChoice, previewBuy } from "@/lib/polymarket-markets";

type Quote = Awaited<ReturnType<typeof previewBuy>>;
type Receipt = { ok: boolean; status: string; requestId?: string; orderId?: string; message?: string; error?: string; transactionHashes?: string[] };
const field = "mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-violet-600";
const button = "rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-violet-600 disabled:opacity-50";
async function read<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "The request could not be completed. Please retry.");
  return body as T;
}

export default function MarketOrderPanel() {
  const { data: session, status } = useSession();
  const [query, setQuery] = useState("");
  const [markets, setMarkets] = useState<MarketChoice[]>([]);
  const [slug, setSlug] = useState("");
  const [outcome, setOutcome] = useState("");
  const [amount, setAmount] = useState("1");
  const [ceiling, setCeiling] = useState("60");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState<string | null>("search");
  const [error, setError] = useState("");
  const [requestId, setRequestId] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [expired, setExpired] = useState(false);
  const submitting = useRef(false);
  const selected = markets.find(m => m.slug === slug);
  const storageKey = session?.user.id ? `zircon:order-request:${session.user.id}` : null;

  useEffect(() => {
    const controller = new AbortController();
    read<{ markets: MarketChoice[] }>("/api/polymarket/markets", { signal: controller.signal })
      .then(data => { setMarkets(data.markets); setBusy(null); })
      .catch(() => { if (!controller.signal.aborted) { setError("Markets could not be loaded. Try searching again."); setBusy(null); } });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!storageKey) return;
    // Restore only the signed-in user's request reference after navigation.
    try { const saved = sessionStorage.getItem(storageKey); if (saved) setRequestId(saved); } catch { /* Reference remains visible for manual status checks. */ }
  }, [storageKey]);
  useEffect(() => {
    if (!quote) return;
    const timer = setTimeout(() => setExpired(true), Math.max(0, Date.parse(quote.expiresAt) - Date.now()));
    return () => clearTimeout(timer);
  }, [quote]);

  function invalidate() { setQuote(null); setConfirmed(false); setError(""); }
  async function search() {
    setBusy("search"); setError(""); setSlug(""); setOutcome(""); setQuote(null);
    try { setMarkets((await read<{ markets: MarketChoice[] }>(`/api/polymarket/markets?q=${encodeURIComponent(query)}`)).markets); }
    catch (e) { setError(e instanceof Error ? e.message : "Search failed."); setMarkets([]); }
    finally { setBusy(null); }
  }
  async function preview() {
    setBusy("preview"); invalidate();
    try { setQuote(await read<Quote>("/api/polymarket/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ marketSlug: slug, outcome, amountUsd: Number(amount), maxPrice: Number(ceiling) / 100 }) })); setExpired(false); }
    catch (e) { setError(e instanceof Error ? e.message : "Preview failed."); }
    finally { setBusy(null); }
  }
  async function submit() {
    if (!quote || !confirmed || expired || requestId || submitting.current || !storageKey) return;
    submitting.current = true;
    const id = crypto.randomUUID();
    setRequestId(id); setReceipt(null); setBusy("buy"); setError("");
    try { sessionStorage.setItem(storageKey, id); } catch { /* Reference also remains on screen. */ }
    try {
      const response = await fetch("/api/polymarket/test-order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ marketSlug: quote.marketSlug, outcome: quote.outcome, amountUsd: quote.amountUsd, maxPrice: quote.maxPrice, requestId: id, confirm: true }) });
      const body: Receipt = await response.json();
      setReceipt(body);
      if (!response.ok) {
        setError(body.error || "Order could not be placed.");
        // Validation, funding and budget failures happen before the durable
        // reservation. Clear the local reference so the user can correct the
        // inputs and review another order. Keep it for a persisted rejection
        // or an accepted/unknown submission so retries remain idempotent.
        if (!body.requestId && !body.status) {
          setRequestId(null);
          setReceipt(null);
          try { sessionStorage.removeItem(storageKey); } catch { /* best effort */ }
        }
      }
    } catch { setError("Connection interrupted. Use Check order status before placing another purchase."); }
    finally { submitting.current = false; setBusy(null); }
  }
  async function checkOrder() {
    if (!requestId) return;
    setBusy("status"); setError("");
    try {
      const response = await fetch(`/api/polymarket/test-order?requestId=${encodeURIComponent(requestId)}`, { cache: "no-store" });
      const body = await response.json();
      if (response.status === 404) setReceipt({ ok: false, status: "NOT_SUBMITTED", message: "No saved order attempt was found. If you just clicked Buy, check again shortly; otherwise review a new order." });
      else if (!response.ok) throw new Error(body.error || "Order status unavailable.");
      else setReceipt(body);
    } catch (e) { setError(e instanceof Error ? e.message : "Order status unavailable."); }
    finally { setBusy(null); }
  }
  function newOrder() {
    if (!receipt || (!receipt.ok && !["REJECTED", "NOT_SUBMITTED"].includes(receipt.status))) return;
    setRequestId(null); setReceipt(null); invalidate();
    if (storageKey) { try { sessionStorage.removeItem(storageKey); } catch {} }
  }

  return <section className="space-y-6" aria-labelledby="market-order-title">
    <div><h2 id="market-order-title" className="text-2xl font-semibold tracking-tight">Choose a market</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Search Polymarket, choose an outcome and review your price. Previewing an order is free and uses no funds.</p></div>
    <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={e => { e.preventDefault(); void search(); }}>
      <label className="flex-1 text-sm font-medium">Search markets<input name="marketSearch" type="search" maxLength={120} autoComplete="off" value={query} onChange={e => setQuery(e.target.value)} placeholder="Try Bitcoin, elections or sports…" className={field} /></label>
      <button className={button} disabled={!!busy || !!requestId}>{busy === "search" ? "Searching…" : "Search"}</button>
    </form>
    {markets.length > 0 ? <label className="block text-sm font-medium">Market<select name="market" className={field} disabled={!!busy || !!requestId} value={slug} onChange={e => { setSlug(e.target.value); setOutcome(""); invalidate(); }}><option value="">Choose a market</option>{markets.map(m => <option key={m.slug} value={m.slug}>{m.question}</option>)}</select></label> : !busy && <p role="status" className="text-sm text-slate-600">No available markets found. Try another search.</p>}
    {selected && <form className="space-y-5" onSubmit={e => { e.preventDefault(); void preview(); }}>
      <fieldset disabled={!!busy || !!requestId}><legend className="text-sm font-medium">Your prediction</legend><div className="mt-2 flex flex-wrap gap-3">{selected.outcomes.map(o => <label key={o.label} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-4 py-3 text-sm"><input type="radio" name="outcome" required value={o.label} checked={outcome === o.label} onChange={() => { setOutcome(o.label); invalidate(); }} />{o.label}</label>)}</div></fieldset>
      <fieldset disabled={!!busy || !!requestId} className="grid gap-4 sm:grid-cols-2"><legend className="sr-only">Order amount and price protection</legend><label className="text-sm font-medium">Amount (USD)<input className={field} name="amount" type="number" inputMode="decimal" required min="1" max="100" step="0.01" value={amount} onChange={e => { setAmount(e.target.value); invalidate(); }} /></label><label className="text-sm font-medium">Maximum price per share (cents)<input className={field} name="priceLimit" type="number" inputMode="decimal" required min="0.01" max="99.99" step="0.01" value={ceiling} onChange={e => { setCeiling(e.target.value); invalidate(); }} /></label></fieldset>
      <button className={button} disabled={!!busy || !!requestId}>{busy === "preview" ? "Checking prices…" : "Preview order"}</button>
    </form>}
    {quote && <div className="space-y-4 border-y border-slate-200 py-5"><h3 className="text-lg font-semibold">Review your order</h3><p className="text-sm">{quote.question} <strong>{quote.outcome}</strong></p><dl className="grid grid-cols-2 gap-4 text-sm"><div><dt className="text-slate-500">Order amount</dt><dd className="mt-1 font-medium">${quote.amountUsd.toFixed(2)}</dd></div><div><dt className="text-slate-500">Estimated shares</dt><dd className="mt-1 font-medium">{quote.estimatedShares.toFixed(2)}</dd></div><div><dt className="text-slate-500">Average price</dt><dd className="mt-1">{(quote.estimatedAveragePrice * 100).toFixed(2)}¢</dd></div><div><dt className="text-slate-500">Price ceiling</dt><dd className="mt-1">{(quote.maxPrice * 100).toFixed(2)}¢</dd></div></dl><p className="text-xs leading-5 text-slate-500">{quote.note} Market minimum: {quote.minimumShares} shares. The order buys the full requested amount or is cancelled if it cannot be filled.</p>
      {expired && <p role="status" className="text-sm text-amber-800">This preview has expired. Preview again to refresh prices.</p>}
      {status !== "authenticated" ? <Link className="inline-block text-sm underline" href="/auth/sign-in?callbackUrl=/trade">Sign in to trade</Link> : <><p className="text-sm text-slate-600">Your <Link href="/wallet" className="underline">trading account</Link> must be funded, approved and enabled for live trading.</p><label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1" checked={confirmed} disabled={!!requestId} onChange={e => setConfirmed(e.target.checked)} /><span>I confirm this {quote.outcome} purchase using real funds. Fees may apply.</span></label><button onClick={() => void submit()} disabled={!!busy || !confirmed || expired || !!requestId} className="cosmic-btn-primary px-5 py-3 text-sm focus-visible:outline-2 focus-visible:outline-violet-600 disabled:opacity-50">{busy === "buy" ? "Submitting order…" : `Buy ${quote.outcome} for $${quote.amountUsd.toFixed(2)}`}</button></>}
    </div>}
    {requestId && <div className="space-y-3 rounded-lg border border-slate-300 p-4"><p className="text-sm font-medium">Order request</p><p className="break-all font-mono text-xs">{requestId}</p><button type="button" onClick={() => void checkOrder()} disabled={!!busy} className={button}>Check order status</button>{receipt && <div role="status" className="space-y-2 text-sm"><p>{receipt.ok ? "Order accepted. Check settlement receipts below." : receipt.message || receipt.error || receipt.status}</p>{receipt.orderId && <p className="break-all text-xs">Order: {receipt.orderId}</p>}{receipt.transactionHashes?.filter(hash => /^0x[0-9a-f]{64}$/i.test(hash)).map(hash => <a key={hash} href={`https://polygonscan.com/tx/${hash}`} target="_blank" rel="noreferrer" className="block underline">View settlement transaction</a>)}{receipt.ok && !receipt.transactionHashes?.length && <p>Settlement is not yet verified. Acceptance alone does not confirm a fill.</p>}{(receipt.ok || ["REJECTED", "NOT_SUBMITTED"].includes(receipt.status)) && <button className={button} onClick={newOrder}>Review a new order</button>}</div>}</div>}
    {error && <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-800">{error}</p>}
  </section>;
}
