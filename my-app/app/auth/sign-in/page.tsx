import Link from "next/link";
import { signIn } from "@/lib/auth";

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string; error?: string }> }) {
  const params = await searchParams;
  const destination = params.callbackUrl?.startsWith("/") && !params.callbackUrl.startsWith("//") ? params.callbackUrl : "/dashboard";
  const configured = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  return <main className="mx-auto max-w-md px-5 py-20">
    <h1 className="text-3xl font-semibold tracking-tight">Your strategy workspace</h1>
    <p className="mt-4 text-slate-600">Sign in to save strategies, connect KeeperHub and manage your runs. Market research is available without an account.</p>
    {params.error && <p role="alert" className="mt-5 text-sm text-red-700">
      {params.error === "OAuthAccountNotLinked"
        ? "This Google email already has a workspace. Try again and we’ll securely link the Google account to it."
        : "Sign-in failed. Please use a verified Google account and try again."}
    </p>}
    {configured ? <form className="mt-8" action={async () => { "use server"; await signIn("google", { redirectTo: destination }); }}>
      <button className="cosmic-btn-primary w-full px-5 py-3">Continue with Google</button>
    </form> : <p role="status" className="mt-8 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Sign-in is not configured on this deployment. The operator must add Google OAuth credentials. Public market research remains available.</p>}
    <div className="mt-6 flex gap-6 text-sm text-violet-700"><Link href="/markets">Explore markets</Link><Link href="/backtest">Try a backtest</Link></div>
    <p className="mt-10 border-t border-slate-200 pt-5 text-sm text-slate-500">Zircon never asks for your wallet seed phrase or private key. Connecting KeeperHub is a separate, explicit step.</p>
  </main>;
}
