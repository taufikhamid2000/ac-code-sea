import Head from "next/head";
import Link from "next/link";
import { chapter01 } from "@/lib/levels";

const BACKDROP = chapter01.backdrop;

export default function Menu() {
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
        <meta property="og:image" content={BACKDROP} />
      </Head>

      <main className="relative flex h-[100dvh] w-full select-none flex-col items-center justify-center overflow-hidden bg-black text-white antialiased">
        {/* Backdrop */}
        <div
          aria-hidden
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${BACKDROP})` }}
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/55 to-black/90"
        />

        {/* Title */}
        <div className="relative z-10 flex flex-col items-center text-center">
          <p className="text-xs font-medium uppercase tracking-[10px] text-white/55">
            AC · Code SEA
          </p>
          <h1 className="mt-3 font-serif text-4xl tracking-wide text-white md:text-6xl">
            Siege of Malacca
          </h1>
          <div className="mt-3 h-px w-24 bg-yellow-500/60" />
          <p className="mt-4 max-w-md text-sm leading-relaxed text-white/55">
            The Brotherhood, in pre-colonial Southeast Asia. No install, no
            signup — just play.
          </p>

          {/* Buttons */}
          <div className="mt-10 flex flex-col items-center gap-3">
            <Link
              href="/play"
              className="w-56 rounded border border-yellow-500/70 bg-yellow-500/90 px-6 py-3 text-center text-sm font-semibold uppercase tracking-[4px] text-black transition hover:bg-yellow-400"
            >
              Start
            </Link>
            <Link
              href="/editor"
              className="w-56 rounded border border-white/25 px-6 py-3 text-center text-sm font-semibold uppercase tracking-[4px] text-white/80 transition hover:bg-white/10 hover:text-white"
            >
              Level Editor
            </Link>
          </div>
        </div>

        {/* Footer hint */}
        <p className="absolute bottom-6 z-10 text-[10px] uppercase tracking-[4px] text-white/35">
          Chapter I · 1511
        </p>
      </main>
    </>
  );
}
