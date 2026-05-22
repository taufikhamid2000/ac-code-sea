import { motion } from "framer-motion";
import type { Scene as SceneType, Choice } from "@/lib/story";

type Props = {
  scene: SceneType;
  onChoose: (next: Choice["next"]) => void;
  onRestart: () => void;
};

const paragraphVariant = {
  hidden: { opacity: 0, y: 8 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.15 + i * 0.18, duration: 0.5, ease: "easeOut" },
  }),
};

const choiceVariant = {
  hidden: { opacity: 0, y: 12 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.6 + i * 0.12, duration: 0.4, ease: "easeOut" },
  }),
};

export default function Scene({ scene, onChoose, onRestart }: Props) {
  return (
    <motion.div
      key={scene.id}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
      className="absolute inset-0"
    >
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${scene.image})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/90" />

      <div className="relative z-10 flex h-full w-full flex-col">
        <div className="px-5 pt-6 md:px-10 md:pt-10">
          {scene.chapter && (
            <p className="text-[10px] font-medium uppercase tracking-[6px] text-yellow-500/90">
              {scene.chapter}
            </p>
          )}
          {scene.title && (
            <h2 className="mt-2 text-xl font-semibold tracking-wide text-white/90 md:text-2xl">
              {scene.title}
            </h2>
          )}
        </div>

        <div className="flex flex-1" />

        <div className="px-5 pb-8 md:px-10 md:pb-12">
          <div className="mx-auto max-w-2xl space-y-4 text-[15px] leading-relaxed text-white/95 md:text-base">
            {scene.body.map((p, i) => (
              <motion.p
                key={i}
                custom={i}
                initial="hidden"
                animate="show"
                variants={paragraphVariant}
              >
                {p}
              </motion.p>
            ))}
          </div>

          <div className="mx-auto mt-7 max-w-2xl">
            {scene.isEnding ? (
              <Ending scene={scene} onRestart={onRestart} />
            ) : (
              <div className="flex flex-col gap-3">
                {scene.choices?.map((c, i) => (
                  <motion.button
                    key={c.label}
                    custom={i}
                    initial="hidden"
                    animate="show"
                    variants={choiceVariant}
                    onClick={() => onChoose(c.next)}
                    className="group w-full rounded border border-white/20 bg-white/5 px-4 py-3.5 text-left text-sm text-white/90 backdrop-blur-sm transition-all hover:border-yellow-500/60 hover:bg-white/10 hover:text-white active:scale-[0.99] md:text-base"
                  >
                    <span className="mr-2 text-yellow-500/80 group-hover:text-yellow-400">
                      →
                    </span>
                    {c.label}
                  </motion.button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function Ending({
  scene,
  onRestart,
}: {
  scene: SceneType;
  onRestart: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.9, duration: 0.6 }}
      className="flex flex-col gap-4"
    >
      <div className="border-t border-yellow-500/40 pt-4">
        <p className="text-[10px] font-medium uppercase tracking-[5px] text-yellow-500/90">
          Ending
        </p>
        {scene.endingTitle && (
          <p className="mt-1 text-lg italic text-white md:text-xl">
            {scene.endingTitle}
          </p>
        )}
      </div>
      <button
        onClick={onRestart}
        className="self-start rounded border border-yellow-500/60 bg-yellow-500/10 px-5 py-3 text-sm font-medium uppercase tracking-widest text-yellow-200 transition-all hover:bg-yellow-500/20 hover:text-yellow-100 active:scale-[0.99]"
      >
        Play again
      </button>
    </motion.div>
  );
}
