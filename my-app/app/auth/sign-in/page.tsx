import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { signIn } from "@/lib/auth";
import { OrbitMark } from "@/components/brand/OrbitMark";

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string; error?: string }> }) {
  const params = await searchParams;
  const destination = params.callbackUrl?.startsWith("/") && !params.callbackUrl.startsWith("//") ? params.callbackUrl : "/dashboard";
  const configured = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

  return (
    <main className="flex min-h-[calc(100dvh-10rem)] items-center justify-center px-5 py-16">
      <div className="relative w-full max-w-md">
        <div aria-hidden="true" className="pointer-events-none absolute -top-32 left-1/2 h-72 w-[34rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(224,97,159,0.28),transparent)]" />
        <div className="c-panel c-fade-in relative p-8 sm:p-10">
          <OrbitMark className="h-12 w-12" />
          <p className="c-eyebrow mt-8">Welcome aboard</p>
          <h1 className="c-serif mt-3 text-5xl leading-none text-white">
            Enter <em className="c-nebula-text">mission control.</em>
          </h1>
          <p className="mt-4 leading-relaxed text-[var(--c-dim)]">
            Sign in to save strategies, launch bots and review every run. Market research works without an account.
          </p>

          {params.error && (
            <p role="alert" className="mt-6 rounded-2xl border border-rose-300/50 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {params.error === "OAuthAccountNotLinked"
                ? "This Google email already has a workspace. Try again and we’ll securely link the Google account to it."
                : params.error === "Configuration"
                  ? "Sign-in is temporarily unavailable because the server could not complete authentication. The operator should check database connectivity and the authentication logs."
                  : "Sign-in failed. Please use a verified Google account and try again."}
            </p>
          )}

          {configured ? (
            <form
              className="mt-8"
              action={async () => {
                "use server";
                await signIn("google", { redirectTo: destination });
              }}
            >
              <button className="c-btn-primary w-full !min-h-12">
                <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                  <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8Z" />
                  <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24Z" />
                  <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1Z" />
                  <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9Z" />
                </svg>
                Continue with Google
              </button>
            </form>
          ) : (
            <p role="status" className="mt-8 rounded-2xl border border-amber-300/50 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Sign-in is not configured on this deployment. The operator must add Google OAuth credentials. Public market research remains available.
            </p>
          )}

          <div className="mt-6 flex flex-wrap gap-2">
            <Link href="/markets" className="c-btn-ghost c-btn-sm">
              Explore markets
            </Link>
            <Link href="/backtest" className="c-btn-ghost c-btn-sm">
              Try a backtest
            </Link>
          </div>

          <p className="mt-8 flex items-start gap-2 border-t border-white/10 pt-6 text-xs leading-relaxed text-[var(--c-faint)]">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--c-pink)]" />
            Zircon never asks for your wallet seed phrase or private key. Connecting KeeperHub is a separate, explicit step.
          </p>
        </div>
      </div>
    </main>
  );
}
