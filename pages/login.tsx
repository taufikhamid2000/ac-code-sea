import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { AuthBrandingPanel } from "@/components/AuthBrandingPanel";
import { AppLogoMark } from "@/components/AppLogoMark";
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { useUser } from "@/lib/auth/useUser";

export default function LoginPage() {
  const router = useRouter();
  const { user, loading } = useUser();
  const configured = isSupabaseConfigured();

  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);

  // Already signed in — bounce straight to the menu.
  useEffect(() => {
    if (!loading && user) {
      router.replace("/");
    }
  }, [loading, user, router]);

  async function submit() {
    setBusy(true);
    setError("");
    setMessage("");
    const sb = getBrowserClient();
    try {
      if (mode === "up") {
        const { error } = await sb.auth.signUp({ email, password });
        if (error) throw error;
        setMessage("Account created. Check your email to confirm, then sign in.");
      } else {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace("/");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function tryDemo() {
    setDemoBusy(true);
    setError("");
    try {
      const sb = getBrowserClient();
      const { error } = await sb.auth.signInAnonymously();
      if (error) throw error;
      router.replace("/");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDemoBusy(false);
    }
  }

  return (
    <>
      <Head>
        <title>Sign in · AC · Code SEA</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main className="flex min-h-[100dvh] w-full flex-col bg-black text-white antialiased md:flex-row">
        <AuthBrandingPanel />

        <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-neutral-950 px-4 py-10">
          <Link href="/" className="flex items-center gap-2 md:hidden">
            <AppLogoMark size={20} className="text-yellow-500/90" />
            <span className="text-sm font-medium uppercase tracking-[4px] text-white/70">
              AC · Code SEA
            </span>
          </Link>

          <div className="w-full max-w-sm rounded-lg border border-white/10 bg-white/[0.03] p-8">
            {!configured ? (
              <p className="text-sm text-white/50">
                Accounts aren&apos;t configured yet (missing Supabase env).
              </p>
            ) : (
              <>
                <div className="mb-4 flex gap-2 text-xs">
                  <button
                    onClick={() => setMode("in")}
                    className={`rounded px-3 py-1.5 uppercase tracking-[3px] transition-colors ${
                      mode === "in"
                        ? "bg-yellow-500/90 text-black"
                        : "border border-white/20 text-white/70 hover:bg-white/10"
                    }`}
                  >
                    Sign in
                  </button>
                  <button
                    onClick={() => setMode("up")}
                    className={`rounded px-3 py-1.5 uppercase tracking-[3px] transition-colors ${
                      mode === "up"
                        ? "bg-yellow-500/90 text-black"
                        : "border border-white/20 text-white/70 hover:bg-white/10"
                    }`}
                  >
                    Sign up
                  </button>
                </div>

                <h1 className="font-serif text-xl">
                  {mode === "up" ? "Create an account" : "Welcome back"}
                </h1>
                <p className="mb-6 text-sm text-white/50">
                  {mode === "up"
                    ? "Save your progress and share levels with the community."
                    : "Sign in to continue your campaign."}
                </p>

                {message ? (
                  <p className="rounded border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/80">
                    {message}
                  </p>
                ) : (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      submit();
                    }}
                    className="flex flex-col gap-3"
                  >
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Email"
                      required
                      className="rounded border border-white/15 bg-black/30 px-3 py-2 text-sm focus:outline focus:outline-2 focus:outline-yellow-500/60"
                    />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Password"
                      required
                      autoComplete={mode === "up" ? "new-password" : "current-password"}
                      className="rounded border border-white/15 bg-black/30 px-3 py-2 text-sm focus:outline focus:outline-2 focus:outline-yellow-500/60"
                    />
                    {error && (
                      <p role="alert" className="text-sm text-red-400">
                        {error}
                      </p>
                    )}
                    <button
                      type="submit"
                      disabled={busy}
                      className="rounded bg-yellow-500/90 px-3 py-2 text-sm font-semibold uppercase tracking-[3px] text-black transition-colors hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {busy ? "…" : mode === "up" ? "Create account" : "Sign in"}
                    </button>
                  </form>
                )}

                <div className="my-4 flex items-center gap-3 text-[10px] uppercase tracking-[3px] text-white/30">
                  <span className="h-px flex-1 bg-white/10" /> or{" "}
                  <span className="h-px flex-1 bg-white/10" />
                </div>

                <button
                  onClick={tryDemo}
                  disabled={demoBusy}
                  className="flex w-full items-center justify-center gap-2 rounded border border-white/20 px-3 py-2 text-sm text-white/85 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {demoBusy ? "Starting demo…" : "Try the demo — no account needed"}
                </button>
              </>
            )}
          </div>

          <p className="text-center text-xs text-white/30 md:hidden">
            A project by{" "}
            <a
              href="https://taufik.vercel.app"
              target="_blank"
              rel="noopener noreferrer"
              className="underline-offset-2 hover:text-white/50 hover:underline"
            >
              Muhammad Taufik &rarr;
            </a>
          </p>
        </div>
      </main>
    </>
  );
}
