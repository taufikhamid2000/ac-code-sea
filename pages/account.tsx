import Head from "next/head";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { useUser, displayName } from "@/lib/auth/useUser";
import { listMine, deleteLevel, type LevelSummary } from "@/lib/levels/cloud";

export default function Account() {
  const { user, loading } = useUser();
  const configured = isSupabaseConfigured();

  if (!configured) {
    return (
      <Shell>
        <p className="text-white/50">
          Accounts aren&apos;t configured yet (missing Supabase env).
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      {loading ? (
        <p className="text-white/40">Loading…</p>
      ) : user ? (
        <SignedIn />
      ) : (
        <SignedOut />
      )}
    </Shell>
  );
}

function SignedOut() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setMsg("");
    const sb = getBrowserClient();
    try {
      if (mode === "up") {
        const { error } = await sb.auth.signUp({ email, password });
        if (error) throw error;
        setMsg("Account created. Check your email to confirm, then sign in.");
      } else {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const sb = getBrowserClient();
    const { error } = await sb.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/account` },
    });
    if (error) setMsg(error.message);
  }

  return (
    <div className="max-w-sm">
      <div className="mb-4 flex gap-2 text-xs">
        <button
          onClick={() => setMode("in")}
          className={`rounded px-3 py-1.5 uppercase tracking-[3px] ${
            mode === "in" ? "bg-yellow-500/90 text-black" : "border border-white/20 text-white/70"
          }`}
        >
          Sign in
        </button>
        <button
          onClick={() => setMode("up")}
          className={`rounded px-3 py-1.5 uppercase tracking-[3px] ${
            mode === "up" ? "bg-yellow-500/90 text-black" : "border border-white/20 text-white/70"
          }`}
        >
          Sign up
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="rounded border border-white/15 bg-black/30 px-3 py-2 text-sm"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="rounded border border-white/15 bg-black/30 px-3 py-2 text-sm"
        />
        <button
          onClick={submit}
          disabled={busy}
          className="rounded bg-yellow-500/90 px-3 py-2 text-sm font-semibold uppercase tracking-[3px] text-black hover:bg-yellow-400 disabled:opacity-50"
        >
          {busy ? "…" : mode === "up" ? "Create account" : "Sign in"}
        </button>
      </div>

      <div className="my-4 flex items-center gap-3 text-[10px] uppercase tracking-[3px] text-white/30">
        <span className="h-px flex-1 bg-white/10" /> or <span className="h-px flex-1 bg-white/10" />
      </div>

      <button
        onClick={google}
        className="flex w-full items-center justify-center gap-2 rounded border border-white/20 px-3 py-2 text-sm text-white/85 hover:bg-white/10"
      >
        Continue with Google
      </button>

      {msg && <p className="mt-3 text-xs text-yellow-300">{msg}</p>}
    </div>
  );
}

function SignedIn() {
  const { user } = useUser();
  const [levels, setLevels] = useState<LevelSummary[] | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!user) return;
    listMine(user.id)
      .then(setLevels)
      .catch((e) => setErr(e.message));
  }, [user]);

  async function signOut() {
    await getBrowserClient().auth.signOut();
  }

  async function remove(slug: string) {
    if (!confirm("Delete this level permanently?")) return;
    try {
      await deleteLevel(slug);
      setLevels((ls) => (ls ?? []).filter((l) => l.slug !== slug));
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-white/70">
          Signed in as <span className="text-white">{displayName(user)}</span>
        </p>
        <button
          onClick={signOut}
          className="rounded border border-white/20 px-3 py-1.5 text-xs uppercase tracking-[3px] text-white/70 hover:bg-white/10"
        >
          Sign out
        </button>
      </div>

      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-[3px] text-yellow-500/70">
          My Levels
        </h2>
        <Link href="/editor" className="text-xs text-sky-400 underline">
          + New level
        </Link>
      </div>

      {err && <p className="text-xs text-red-400">{err}</p>}
      {levels === null && !err && <p className="text-white/40">Loading…</p>}
      {levels && levels.length === 0 && (
        <p className="text-sm text-white/40">
          No levels yet. <Link href="/editor" className="text-sky-400 underline">Open the editor</Link>.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {levels?.map((l) => (
          <li
            key={l.slug}
            className="flex items-center justify-between rounded border border-white/10 bg-white/[0.03] px-4 py-3"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{l.title}</p>
              <p className="text-[11px] text-white/40">{l.plays} plays</p>
            </div>
            <div className="flex shrink-0 gap-2 text-xs">
              <Link href={`/editor?load=${l.slug}`} className="rounded border border-white/20 px-2.5 py-1 text-white/75 hover:bg-white/10">
                Edit
              </Link>
              <Link href={`/play?level=${l.slug}`} className="rounded border border-white/20 px-2.5 py-1 text-white/75 hover:bg-white/10">
                Play
              </Link>
              <button onClick={() => remove(l.slug)} className="rounded border border-red-500/40 px-2.5 py-1 text-red-400 hover:bg-red-500/10">
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Head>
        <title>Account · AC · Code SEA</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <main className="min-h-[100dvh] w-full bg-neutral-950 text-white antialiased">
        <div className="mx-auto max-w-2xl px-5 py-10">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="font-serif text-3xl">Account</h1>
            <Link
              href="/"
              className="rounded border border-white/20 px-3 py-1.5 text-xs uppercase tracking-[3px] text-white/70 hover:bg-white/10"
            >
              Menu
            </Link>
          </div>
          {children}
        </div>
      </main>
    </>
  );
}
