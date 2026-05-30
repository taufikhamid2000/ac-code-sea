import Head from "next/head";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { chapter01 } from "@/lib/levels";
import type { LevelDef } from "@/lib/levels/types";
import { loadBySlug } from "@/lib/levels/cloud";

// Canvas + window access — client-only.
const Platformer = dynamic(() => import("@/components/game/Platformer"), {
  ssr: false,
});

export default function Play() {
  const router = useRouter();
  const [level, setLevel] = useState<LevelDef>(chapter01);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // When ?level=<slug> is present, load that community level.
  useEffect(() => {
    if (!router.isReady) return;
    const slug = router.query.level;
    if (typeof slug !== "string" || !slug) {
      setLevel(chapter01);
      return;
    }
    setLoading(true);
    setLoadError(null);
    loadBySlug(slug)
      .then((row) => setLevel(row.data))
      .catch((e) => setLoadError((e as Error).message))
      .finally(() => setLoading(false));
  }, [router.isReady, router.query.level]);

  const ACTIVE_LEVEL = level;
  const levelKey =
    typeof router.query.level === "string" ? router.query.level : level.id;

  return (
    <>
      <Head>
        <title>AC · Code SEA</title>
        <meta
          name="description"
          content="A browser-playable 2D side-scroller. The Brotherhood, in pre-colonial Southeast Asia."
        />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <meta name="theme-color" content="#000000" />
        <meta property="og:title" content="AC · Code SEA" />
        <meta
          property="og:description"
          content="The Brotherhood, in pre-colonial Southeast Asia."
        />
        <meta property="og:image" content={ACTIVE_LEVEL.backdrop} />
      </Head>

      <main className="relative h-[100dvh] w-full select-none overflow-hidden bg-black text-white antialiased">
        {/* Backdrop */}
        <div
          aria-hidden
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${ACTIVE_LEVEL.backdrop})` }}
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/40 to-black/90"
        />

        {/* Game canvas — keyed so it remounts when the level changes */}
        <div className="absolute inset-0">
          <Platformer key={levelKey} level={ACTIVE_LEVEL} />
        </div>

        {/* Load state for community levels */}
        {loading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 text-xs uppercase tracking-[4px] text-white/70">
            Loading level…
          </div>
        )}
        {loadError && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/80 text-center">
            <p className="text-sm text-red-300">{loadError}</p>
            <Link
              href="/levels"
              className="rounded border border-white/25 px-4 py-2 text-[11px] uppercase tracking-[3px] text-white/80 hover:bg-white/10"
            >
              ← Community Levels
            </Link>
          </div>
        )}

        {/* Back to menu */}
        <Link
          href="/"
          className="pointer-events-auto absolute right-5 top-4 z-10 rounded border border-white/20 bg-white/5 px-2.5 py-1 text-[10px] uppercase tracking-[3px] text-white/60 backdrop-blur transition hover:bg-white/10 hover:text-white/90 md:right-10 md:top-6"
        >
          ← Menu
        </Link>

        {/* Title chip */}
        <div className="pointer-events-none absolute left-5 top-4 z-10 md:left-10 md:top-6">
          <p className="text-[10px] font-medium uppercase tracking-[6px] text-white/60">
            AC · Code SEA
          </p>
          <p className="mt-1 text-[9px] uppercase tracking-[4px] text-yellow-500/70">
            {ACTIVE_LEVEL.chapter} · {ACTIVE_LEVEL.title}
          </p>
        </div>

        {/* Controls HUD */}
        <div className="pointer-events-none absolute bottom-5 right-5 z-10 flex flex-col items-end gap-1 text-[11px] uppercase tracking-[3px] text-white/55 md:bottom-8 md:right-10">
          <span>
            <Key>A</Key> / <Key>D</Key> &nbsp;move
          </span>
          <span>
            <Key>Shift</Key> &nbsp;sprint
          </span>
          <span>
            <Key>Space</Key> &nbsp;jump
          </span>
          <span>
            <Key>S</Key> &nbsp;crouch
          </span>
          <span>
            <Key>E</Key> &nbsp;strike&nbsp;/&nbsp;parry&nbsp;/&nbsp;kill
          </span>
          <span>
            <Key>R</Key> &nbsp;restart
          </span>
        </div>
      </main>
    </>
  );
}

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-block min-w-[1.4em] rounded border border-white/25 bg-white/5 px-1.5 py-0.5 text-center font-mono text-[10px] text-white/80">
      {children}
    </kbd>
  );
}
