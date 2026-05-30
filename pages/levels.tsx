import Head from "next/head";
import Link from "next/link";
import { useEffect, useState } from "react";

type LevelSummary = {
  slug: string;
  title: string;
  chapter: string;
  author: string;
  plays: number;
  created_at: string;
};

export default function CommunityLevels() {
  const [levels, setLevels] = useState<LevelSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/levels")
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error ?? "Failed to load levels.");
        return json;
      })
      .then((json) => setLevels(json.levels))
      .catch((e) => setError(e.message));
  }, []);

  return (
    <>
      <Head>
        <title>Community Levels · AC · Code SEA</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main className="min-h-[100dvh] w-full bg-neutral-950 text-white antialiased">
        <div className="mx-auto max-w-3xl px-5 py-10">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[6px] text-white/45">
                AC · Code SEA
              </p>
              <h1 className="mt-1 font-serif text-3xl">Community Levels</h1>
            </div>
            <div className="flex gap-2 text-xs">
              <Link
                href="/editor"
                className="rounded border border-white/20 px-3 py-1.5 uppercase tracking-[3px] text-white/70 hover:bg-white/10"
              >
                Create
              </Link>
              <Link
                href="/"
                className="rounded border border-white/20 px-3 py-1.5 uppercase tracking-[3px] text-white/70 hover:bg-white/10"
              >
                Menu
              </Link>
            </div>
          </div>

          {error && (
            <p className="rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
              {error}
            </p>
          )}

          {!error && levels === null && (
            <p className="text-white/40">Loading…</p>
          )}

          {levels && levels.length === 0 && (
            <p className="text-white/40">
              No levels published yet. Be the first —{" "}
              <Link href="/editor" className="text-sky-400 underline">
                open the editor
              </Link>
              .
            </p>
          )}

          <ul className="flex flex-col gap-2">
            {levels?.map((l) => (
              <li key={l.slug}>
                <Link
                  href={`/play?level=${l.slug}`}
                  className="flex items-center justify-between rounded border border-white/10 bg-white/[0.03] px-4 py-3 transition hover:border-yellow-500/40 hover:bg-white/[0.06]"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{l.title}</p>
                    <p className="mt-0.5 text-[11px] uppercase tracking-[2px] text-white/40">
                      {l.chapter ? `${l.chapter} · ` : ""}by {l.author}
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] text-white/35">
                    {l.plays} plays
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </main>
    </>
  );
}
