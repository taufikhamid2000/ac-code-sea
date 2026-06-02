import { useEffect, useRef } from "react";
import type { LevelDef } from "@/lib/levels";
import TouchControls from "./TouchControls";

type Props = {
  level: LevelDef;
};

/**
 * Thin React wrapper that boots a Phaser game inside a div and tears it
 * down on unmount. All gameplay lives in lib/game/scenes/LevelScene.
 *
 * Phaser is loaded lazily so it stays out of the initial SSR/CSR bundle
 * until the page mounts.
 */
export default function Platformer({ level }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const parent = containerRef.current;
    if (!parent) return;

    let game: import("phaser").Game | null = null;
    let cancelled = false;

    (async () => {
      const Phaser = (await import("phaser")).default;
      const { LevelScene } = await import("@/lib/game/scenes/LevelScene");
      if (cancelled) return;

      game = new Phaser.Game({
        type: Phaser.AUTO,
        parent,
        width: window.innerWidth,
        height: window.innerHeight,
        transparent: true,
        physics: {
          default: "arcade",
          arcade: {
            gravity: { x: 0, y: 0 }, // scene sets its own
            debug: false,
          },
        },
        scale: {
          mode: Phaser.Scale.RESIZE,
          autoCenter: Phaser.Scale.NO_CENTER,
        },
        scene: new LevelScene(level),
      });
    })();

    return () => {
      cancelled = true;
      if (game) game.destroy(true);
    };
  }, [level]);

  return (
    <>
      <div
        ref={containerRef}
        className="absolute inset-0 [&>canvas]:!block [&>canvas]:!h-full [&>canvas]:!w-full"
      />
      <TouchControls />
    </>
  );
}
