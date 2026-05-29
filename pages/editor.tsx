import Head from "next/head";
import dynamic from "next/dynamic";

// Editor touches window/localStorage and lazy-loads Phaser for play-test.
const LevelEditor = dynamic(() => import("@/components/editor/LevelEditor"), {
  ssr: false,
});

export default function EditorPage() {
  return (
    <>
      <Head>
        <title>Level Editor · AC Code SEA</title>
        <meta name="robots" content="noindex" />
      </Head>
      <LevelEditor />
    </>
  );
}
