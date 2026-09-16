"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { ArrowRight, Check, ChevronDown, Server, Wallet } from "lucide-react";
import { EmptyState, Notice, PageHeader, PageShell, StatusBadge } from "@/components/ui/page";
import Skeleton from "@/components/ui/skeleton";

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

  if (status === "unauthenticated") {
    return (
      <PageShell width="narrow">
        <EmptyState
          title="Where your bots run"
          body="Sign in to see which workflow engine runs your bots and where your trading wallet lives."
          action={<Link href="/auth/sign-in?callbackUrl=/connections" className="c-btn-primary">Sign in <ArrowRight className="h-4 w-4" /></Link>}
        />
      </PageShell>
    );
  }

  return (
    <PageShell width="medium">
      <PageHeader eyebrow="Connections" title="Ground" accent="control." description="Where your bots run, and where their money lives." />

      {status === "loading" ? (
        <Skeleton className="h-48" />
      ) : (
        <div className="space-y-5">
          <section className="c-panel p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-4">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-[rgba(146,119,245,0.4)] to-[rgba(224,97,159,0.3)]">
                  <Server className="h-5 w-5 text-white" />
                </span>
                <div>
                  <h2 className="c-serif text-3xl text-white">Workflow engine</h2>
                  <p className="text-sm text-[var(--c-dim)]">KeeperHub runs every bot on schedule.</p>
                </div>
              </div>
              {!connection.isLoading && (own ? <StatusBadge tone="active">Your organization</StatusBadge> : managed ? <StatusBadge tone="active">Hosted by Zircon</StatusBadge> : <StatusBadge tone="danger">Not configured</StatusBadge>)}
            </div>

            <div className="mt-6">
              {connection.isLoading ? (
                <Skeleton className="h-12" />
              ) : own ? (
                <>
                  <p className="flex items-start gap-2 text-sm text-[var(--c-dim)]">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--c-up)]" />
                    Running in your own KeeperHub organization (<span className="c-mono">{own.keyPrefix}…</span>), verified {new Date(own.verifiedAt).toLocaleString()}.
                  </p>
                  <button disabled={busy} onClick={() => update("DELETE")} className="c-btn-danger c-btn-sm mt-5">
                    Disconnect and use Zircon&rsquo;s hosted engine
                  </button>
                </>
              ) : managed ? (
                <p className="flex items-start gap-2 text-sm leading-relaxed text-[var(--c-dim)]">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--c-up)]" />
                  <span>
                    Ready — nothing to set up. Zircon runs your bots on KeeperHub for you. Your trades are placed from your own wallet,
                    which only you can fund or withdraw from.
                  </span>
                </p>
              ) : (
                <Notice tone="warning">
                  This deployment has no workflow engine configured. An administrator needs to set <code className="c-mono text-xs">KEEPERHUB_API_KEY</code>, or you can connect your own organization below.
                </Notice>
              )}
            </div>

            <div className="mt-6 border-t border-white/10 pt-5">
              <button
                onClick={() => setShowAdvanced(v => !v)}
                aria-expanded={showAdvanced}
                className="flex items-center gap-2 text-sm text-[var(--c-dim)] hover:text-white"
              >
                <ChevronDown className={`h-4 w-4 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
                Advanced: run bots in your own KeeperHub organization
              </button>
              {showAdvanced && (
                <div className="c-fade-in mt-5 space-y-4 rounded-2xl border border-white/10 bg-black/25 p-5">
                  <p className="text-sm leading-relaxed text-[var(--c-dim)]">
                    Optional. Use this if you want your workflows, run history and spending controls to live in an organization you own.
                    Create a key in KeeperHub under Settings → Developer → API keys.
                  </p>
                  <a href="https://app.keeperhub.com" target="_blank" rel="noopener noreferrer" className="inline-block text-sm text-[var(--c-pink)] hover:underline">
                    Open KeeperHub ↗
                  </a>
                  <form onSubmit={e => { e.preventDefault(); void update("PUT"); }} className="space-y-3">
                    <label htmlFor="keeperhub-key" className="c-label">
                      {own ? "Replace organization key" : "Organization API key"}
                    </label>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        id="keeperhub-key" type="password" autoComplete="new-password" spellCheck={false}
                        value={key} onChange={e => setKey(e.target.value)} placeholder="kh_…"
                        className="c-input c-mono"
                      />
                      <button disabled={busy || !key.trim()} className="c-btn-primary">
                        {busy ? "Verifying…" : "Verify and connect"}
                      </button>
                    </div>
                  </form>
                  <p className="text-xs leading-relaxed text-[var(--c-faint)]">
                    Keys are encrypted on the server and never returned to the browser. They are not wallet private keys.
                    Disconnecting removes Zircon&rsquo;s copy; revoke the key in KeeperHub to invalidate it.
                  </p>
                </div>
              )}
            </div>
          </section>

          {message && <Notice tone="success">{message}</Notice>}
          {error && <Notice tone="error">{error}</Notice>}

          <section className="c-panel flex flex-wrap items-center justify-between gap-5 p-6 sm:p-8">
            <div className="flex items-center gap-4">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-[rgba(232,172,78,0.4)] to-[rgba(224,97,159,0.3)]">
                <Wallet className="h-5 w-5 text-white" />
              </span>
              <div className="max-w-md">
                <h2 className="c-serif text-3xl text-white">Trading wallet</h2>
                <p className="text-sm leading-relaxed text-[var(--c-dim)]">
                  Real-money bots buy from a Polygon wallet created for your account alone. Zircon never holds the private key.
                </p>
              </div>
            </div>
            <Link href="/wallet" className="c-btn-ghost">
              Open wallet <ArrowRight className="h-4 w-4" />
            </Link>
          </section>
        </div>
      )}
    </PageShell>
  );
}
