import Head from "next/head";
import dynamic from "next/dynamic";
import { level01 } from "@/lib/levels";

// Canvas + window access — client-only.
const Platformer = dynamic(() => import("@/components/game/Platformer"), {
  ssr: false,
});

const ACTIVE_LEVEL = level01;

export default function Home() {
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

        {/* Game canvas */}
        <div className="absolute inset-0">
          <Platformer level={ACTIVE_LEVEL} />
        </div>

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
