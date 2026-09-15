"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { Check, ChevronDown } from "lucide-react";

type ConnectionState = {
  connection: { keyPrefix: string; verifiedAt: string } | null;
  managedByPlatform: boolean;
};

export default function ConnectionsPage() {
  const { status } = useSession();
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const connection = useQuery({
    queryKey: ["keeperhub-connection"],
    enabled: status === "authenticated",
    queryFn: async (): Promise<ConnectionState> => {
      const res = await fetch("/api/connections/keeperhub");
      if (!res.ok) throw new Error("Unable to read connection status. Sign in again.");
      return res.json();
    },
  });

  async function update(method: "PUT" | "DELETE") {
    if (method === "DELETE" && !confirm("Disconnect your own KeeperHub organization? Your bots will run in Zircon's hosted environment instead.")) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const res = await fetch("/api/connections/keeperhub", {
        method,
        headers: { "Content-Type": "application/json" },
        body: method === "PUT" ? JSON.stringify({ apiKey: key }) : undefined,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setKey("");
      setMessage(data.warning || "Connection verified and saved.");
      await connection.refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection failed.");
    } finally { setBusy(false); }
  }

  const managed = connection.data?.managedByPlatform ?? false;
  const own = connection.data?.connection ?? null;

  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Connections</h1>
      <p className="mt-3 text-slate-600">Where your bots run.</p>

      {status === "loading" ? (
        <p role="status" className="mt-8">Loading…</p>
      ) : status !== "authenticated" ? (
        <Link href="/auth/sign-in?callbackUrl=/connections" className="mt-8 block text-violet-700 underline">Sign in to continue</Link>
      ) : (
        <>
          <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-semibold">Workflow engine</h2>
            {connection.isLoading ? (
              <p role="status" className="mt-3 text-sm text-slate-500">Checking…</p>
            ) : own ? (
              <>
                <p className="mt-3 flex items-center gap-2 text-sm text-slate-700">
                  <Check className="h-4 w-4 text-emerald-600" />
                  Running in your own KeeperHub organization ({own.keyPrefix}…), verified {new Date(own.verifiedAt).toLocaleString()}.
                </p>
                <button disabled={busy} onClick={() => update("DELETE")} className="mt-4 text-sm text-red-700 underline">
                  Disconnect and use Zircon&rsquo;s hosted engine
                </button>
              </>
            ) : managed ? (
              <p className="mt-3 flex items-start gap-2 text-sm text-slate-700">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <span>
                  Ready — nothing to set up. Zircon runs your bots on KeeperHub for you. Your trades are placed from
                  your own wallet, which only you can fund or withdraw from.
                </span>
              </p>
            ) : (
              <p role="alert" className="mt-3 text-sm text-amber-800">
                This deployment has no workflow engine configured. An administrator needs to set <code className="font-mono text-xs">KEEPERHUB_API_KEY</code>,
                or you can connect your own organization below.
              </p>
            )}
          </section>

          <section className="mt-6">
            <button
              onClick={() => setShowAdvanced(v => !v)}
              aria-expanded={showAdvanced}
              className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              <ChevronDown className={`h-4 w-4 transition ${showAdvanced ? "rotate-180" : ""}`} />
              Advanced: run bots in your own KeeperHub organization
            </button>
            {showAdvanced && (
              <div className="mt-4 space-y-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-6">
                <p className="text-sm leading-6 text-slate-600">
                  Optional. Use this if you want your workflows, run history and spending controls to live in an
                  organization you own. Create a key in KeeperHub under Settings → Developer → API keys.
                </p>
                <a href="https://app.keeperhub.com" target="_blank" rel="noopener noreferrer" className="inline-block text-sm text-violet-700 underline">
                  Open KeeperHub
                </a>
                <form onSubmit={e => { e.preventDefault(); void update("PUT"); }} className="space-y-3">
                  <label htmlFor="keeperhub-key" className="block text-sm font-medium">
                    {own ? "Replace organization key" : "Organization API key"}
                  </label>
                  <input
                    id="keeperhub-key" type="password" autoComplete="new-password" spellCheck={false}
                    value={key} onChange={e => setKey(e.target.value)} placeholder="kh_…"
                    className="w-full rounded-lg border border-slate-300 bg-white p-3 font-mono text-sm"
                  />
                  <button disabled={busy || !key.trim()} className="cosmic-btn-primary px-5 py-3 text-sm disabled:opacity-50">
                    {busy ? "Verifying…" : "Verify and connect"}
                  </button>
                </form>
                <p className="text-xs leading-5 text-slate-500">
                  Keys are encrypted on the server and never returned to the browser. They are not wallet private keys.
                  Disconnecting removes Zircon&rsquo;s copy; revoke the key in KeeperHub to invalidate it.
                </p>
              </div>
            )}
          </section>

          {message && <p role="status" className="mt-5 text-sm text-violet-700">{message}</p>}
          {error && <p role="alert" className="mt-5 text-sm text-red-700">{error}</p>}

          <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-semibold">Your trading wallet</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Real-money bots buy from a Polygon wallet created for your account alone. Zircon never holds the private
              key and cannot withdraw your funds.
            </p>
            <Link href="/wallet" className="mt-4 inline-block text-sm text-violet-700 underline">Open trading wallet</Link>
          </section>
        </>
      )}
    </main>
  );
}
