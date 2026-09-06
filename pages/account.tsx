import Head from "next/head";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { useUser, displayName } from "@/lib/auth/useUser";
import { listMine, deleteLevel, type LevelSummary } from "@/lib/levels/cloud";

// The rest of the app (menu, play, editor, levels) redirects unauthenticated
// visitors to /login — this page assumes it's normally only reachable
// signed in. SignedOut below is just a fallback for the edge case of a
// session expiring mid-visit.
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
  return (
    <div className="max-w-sm rounded-lg border border-white/10 bg-white/[0.03] p-6 animate-in fade-in">
      <p className="mb-4 text-sm text-white/60">
        Your session has ended. Sign in again to see your account.
      </p>
      <Link
        href="/login"
        className="inline-block rounded bg-yellow-500/90 px-4 py-2 text-sm font-semibold uppercase tracking-[3px] text-black transition-colors hover:bg-yellow-400"
      >
        Sign in
      </Link>
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
