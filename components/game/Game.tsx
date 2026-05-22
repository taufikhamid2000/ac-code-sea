import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import Scene from "./Scene";
import { scenes, START, type SceneId } from "@/lib/story";

export default function Game() {
  const [current, setCurrent] = useState<SceneId>(START);
  const scene = scenes[current];

  return (
    <main className="relative h-[100dvh] w-full select-none overflow-hidden bg-black text-white antialiased">
      <AnimatePresence mode="wait">
        <Scene
          key={scene.id}
          scene={scene}
          onChoose={(next) => setCurrent(next)}
          onRestart={() => setCurrent(START)}
        />
      </AnimatePresence>

      <div className="pointer-events-none absolute left-0 right-0 top-0 z-20 flex justify-between px-5 pt-3 md:px-10 md:pt-5">
        <p className="text-[10px] font-medium uppercase tracking-[6px] text-white/60">
          AC · Code SEA
        </p>
      </div>
    </main>
  );
}
