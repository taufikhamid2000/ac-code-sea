import Head from "next/head";
import dynamic from "next/dynamic";
import { useRequireUser } from "@/lib/auth/useRequireUser";

// Editor touches window/localStorage and lazy-loads Phaser for play-test.
const LevelEditor = dynamic(() => import("@/components/editor/LevelEditor"), {
  ssr: false,
});

export default function EditorPage() {
  const { loading } = useRequireUser();

  return (
    <>
      <Head>
        <title>Level Editor · AC Code SEA</title>
        <meta name="robots" content="noindex" />
      </Head>
      {loading ? (
        <main className="flex h-[100dvh] w-full items-center justify-center bg-black text-white/40">
          <p className="text-xs uppercase tracking-[4px]">Loading…</p>
        </main>
      ) : (
        <LevelEditor />
      )}
    </>
  );
}
