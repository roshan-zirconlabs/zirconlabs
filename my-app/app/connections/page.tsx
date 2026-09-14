"use client";
import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";

export default function ConnectionsPage() {
  const { status } = useSession();
  const [key, setKey] = useState(""); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(""); const [error, setError] = useState("");
  const connection = useQuery({ queryKey: ["keeperhub-connection"], enabled: status === "authenticated", queryFn: async () => {
    const res = await fetch("/api/connections/keeperhub"); if (!res.ok) throw new Error("Unable to read connection status. Check database setup and sign in again.");
    return res.json() as Promise<{ connection: { keyPrefix: string; verifiedAt: string } | null }>;
  } });
  async function update(method: "PUT" | "DELETE") {
    if (method === "DELETE" && !confirm("Disconnect Zircon? Existing schedules will continue in KeeperHub until you disable them there.")) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const res = await fetch("/api/connections/keeperhub", { method, headers: { "Content-Type": "application/json" }, body: method === "PUT" ? JSON.stringify({ apiKey: key }) : undefined });
      const data = await res.json(); if (!res.ok) throw new Error(data.error);
      setKey(""); setMessage(data.warning || "Connection verified and saved."); await connection.refetch();
    } catch (e) { setError(e instanceof Error ? e.message : "Connection failed."); }
    finally { setBusy(false); }
  }
  return <main className="mx-auto max-w-3xl px-5 py-12"><h1 className="text-3xl font-semibold tracking-tight">Connections</h1><p className="mt-3 text-slate-600">Choose the KeeperHub organization that will run your workflows.</p>
    <section className="mt-8 space-y-5 border-y border-slate-200 py-7"><h2 className="text-lg font-semibold">KeeperHub</h2><p className="text-sm leading-6 text-slate-600">Create an organization key in KeeperHub under Settings → Developer → API keys. The key can run workflows and spend from that organization’s wallet. Use a dedicated organization and review its members, wallet balance and spending controls.</p>
      <a href="https://app.keeperhub.com" target="_blank" rel="noopener noreferrer" className="inline-block text-sm text-violet-700 underline">Open KeeperHub settings</a>
      {status === "loading" ? <p role="status">Loading session…</p> : status !== "authenticated" ? <Link href="/auth/sign-in?callbackUrl=/connections" className="block text-violet-700 underline">Sign in to connect</Link> : <>
        <p role="status" className="text-sm">{connection.isLoading ? "Checking connection…" : connection.data?.connection ? `Connected with ${connection.data.connection.keyPrefix}… · verified ${new Date(connection.data.connection.verifiedAt).toLocaleString()}` : "No organization connected."}</p>
        {connection.error && <p role="alert" className="text-sm text-red-700">{connection.error.message}</p>}
        <form onSubmit={e => { e.preventDefault(); void update("PUT"); }} className="space-y-3"><label htmlFor="keeperhub-key" className="block text-sm font-medium">{connection.data?.connection ? "Replace organization key" : "Organization API key"}</label><input id="keeperhub-key" type="password" autoComplete="new-password" spellCheck={false} value={key} onChange={e => setKey(e.target.value)} placeholder="kh_…" className="w-full rounded-lg border border-slate-300 bg-white p-3 font-mono text-sm" /><button disabled={busy || !key.trim()} className="cosmic-btn-primary px-5 py-3 text-sm disabled:opacity-50">{busy ? "Verifying…" : "Verify and connect"}</button></form>
        {connection.data?.connection && <button disabled={busy} onClick={() => update("DELETE")} className="text-sm text-red-700 underline">Disconnect from Zircon</button>}
      </>}
      <p className="text-xs leading-5 text-slate-500">Credentials are encrypted on the server and never returned to the browser. They are not wallet private keys. Disconnecting removes this app’s copy; revoke the key in KeeperHub to invalidate it.</p>
    </section>
    {message && <p role="status" className="mt-5 text-sm text-violet-700">{message}</p>}{error && <p role="alert" className="mt-5 text-sm text-red-700">{error}</p>}
    <section className="mt-8"><h2 className="text-lg font-semibold">Wallet custody</h2><p className="mt-3 text-sm leading-6 text-slate-600">KeeperHub manages its organization wallet through Turnkey. Wallet provisioning, withdrawals and key export require a KeeperHub user session. Zircon does not proxy those approval boundaries or collect private keys.</p><Link href="/wallet" className="mt-4 inline-block text-sm text-violet-700 underline">Open Polymarket wallet</Link></section>
  </main>;
}
