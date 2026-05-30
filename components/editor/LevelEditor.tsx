import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type {
  LevelDef,
  PlatformDef,
  EnemyDef,
  NpcDef,
  BushDef,
  LadderDef,
} from "@/lib/levels/types";
import { chapter01 } from "@/lib/levels";
import type { Selection } from "./model";
import Stage from "./Stage";
import Inspector from "./Inspector";
import {
  toLevelTs,
  parseLevel,
  defaultPlatform,
  defaultKnight,
  defaultGuard,
  defaultNpc,
  defaultBush,
  defaultLadder,
} from "./io";

const Platformer = dynamic(() => import("@/components/game/Platformer"), {
  ssr: false,
});

const STORAGE_KEY = "ac-editor-level";

function loadInitial(): LevelDef {
  if (typeof window !== "undefined") {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const res = parseLevel(saved);
      if (res.ok) return res.level;
    }
  }
  // Seed from Chapter I so there's something to look at.
  return JSON.parse(JSON.stringify(chapter01));
}

export default function LevelEditor() {
  const [level, setLevel] = useState<LevelDef>(loadInitial);
  const [selection, setSelection] = useState<Selection>(null);
  const [scale, setScale] = useState(0.6);
  const [grid, setGrid] = useState(10);
  const [snapOn, setSnapOn] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [importText, setImportText] = useState("");
  const [importMsg, setImportMsg] = useState("");
  const [copied, setCopied] = useState(false);

  // Autosave.
  useEffect(() => {
    const id = setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(level));
      } catch {
        /* quota / private mode — ignore */
      }
    }, 300);
    return () => clearTimeout(id);
  }, [level]);

  const patchLevel = (patch: Partial<LevelDef>) =>
    setLevel((l) => ({ ...l, ...patch }));
  const patchPlatform = (i: number, patch: Partial<PlatformDef>) =>
    setLevel((l) => ({
      ...l,
      platforms: l.platforms.map((p, j) => (j === i ? { ...p, ...patch } : p)),
    }));
  const patchEnemy = (i: number, patch: Partial<EnemyDef>) =>
    setLevel((l) => ({
      ...l,
      enemies: l.enemies.map((e, j) =>
        j === i ? ({ ...e, ...patch } as EnemyDef) : e
      ),
    }));
  const patchNpc = (i: number, patch: Partial<NpcDef>) =>
    setLevel((l) => ({
      ...l,
      npcs: (l.npcs ?? []).map((n, j) => (j === i ? { ...n, ...patch } : n)),
    }));
  const patchBush = (i: number, patch: Partial<BushDef>) =>
    setLevel((l) => ({
      ...l,
      bushes: (l.bushes ?? []).map((b, j) => (j === i ? { ...b, ...patch } : b)),
    }));
  const patchLadder = (i: number, patch: Partial<LadderDef>) =>
    setLevel((l) => ({
      ...l,
      ladders: (l.ladders ?? []).map((la, j) =>
        j === i ? { ...la, ...patch } : la
      ),
    }));

  function addPlatform() {
    const x = Math.round(level.worldWidth / 3);
    setLevel((l) => ({ ...l, platforms: [...l.platforms, defaultPlatform(x)] }));
    setSelection({ type: "platform", index: level.platforms.length });
  }
  function addEnemy(kind: "templar-knight" | "templar-guard") {
    const x = Math.round(level.worldWidth / 2);
    const e = kind === "templar-knight" ? defaultKnight(x) : defaultGuard(x);
    setLevel((l) => ({ ...l, enemies: [...l.enemies, e] }));
    setSelection({ type: "enemy", index: level.enemies.length });
  }
  function addNpc() {
    const x = Math.round(level.worldWidth / 2);
    setLevel((l) => ({ ...l, npcs: [...(l.npcs ?? []), defaultNpc(x)] }));
    setSelection({ type: "npc", index: (level.npcs ?? []).length });
  }
  function addBush() {
    const x = Math.round(level.worldWidth / 3);
    setLevel((l) => ({ ...l, bushes: [...(l.bushes ?? []), defaultBush(x)] }));
    setSelection({ type: "bush", index: (level.bushes ?? []).length });
  }
  function addLadder() {
    const x = Math.round(level.worldWidth / 3);
    setLevel((l) => ({ ...l, ladders: [...(l.ladders ?? []), defaultLadder(x)] }));
    setSelection({ type: "ladder", index: (level.ladders ?? []).length });
  }
  function deleteSelected() {
    if (!selection) return;
    if (selection.type === "platform") {
      const i = selection.index;
      setLevel((l) => ({ ...l, platforms: l.platforms.filter((_, j) => j !== i) }));
      setSelection(null);
    } else if (selection.type === "enemy") {
      const i = selection.index;
      setLevel((l) => ({ ...l, enemies: l.enemies.filter((_, j) => j !== i) }));
      setSelection(null);
    } else if (selection.type === "npc") {
      const i = selection.index;
      setLevel((l) => ({
        ...l,
        npcs: (l.npcs ?? []).filter((_, j) => j !== i),
      }));
      setSelection(null);
    } else if (selection.type === "bush") {
      const i = selection.index;
      setLevel((l) => ({
        ...l,
        bushes: (l.bushes ?? []).filter((_, j) => j !== i),
      }));
      setSelection(null);
    } else if (selection.type === "ladder") {
      const i = selection.index;
      setLevel((l) => ({
        ...l,
        ladders: (l.ladders ?? []).filter((_, j) => j !== i),
      }));
      setSelection(null);
    }
  }

  // Delete / Backspace removes the selected platform or enemy — unless the
  // user is typing in a form field.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el?.isContentEditable) {
        return;
      }
      if (
        selection?.type === "platform" ||
        selection?.type === "enemy" ||
        selection?.type === "npc" ||
        selection?.type === "bush" ||
        selection?.type === "ladder"
      ) {
        e.preventDefault();
        deleteSelected();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection]);

  async function copyTs() {
    try {
      await navigator.clipboard.writeText(toLevelTs(level));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  function doImport() {
    const res = parseLevel(importText);
    if (res.ok) {
      setLevel(res.level);
      setSelection(null);
      setImportMsg("Loaded.");
      setImportText("");
    } else {
      setImportMsg(res.error);
    }
  }

  const tsOut = useMemo(() => toLevelTs(level), [level]);

  if (playing) {
    return (
      <div className="relative h-[100dvh] w-full bg-black">
        <div
          aria-hidden
          className="absolute inset-0 bg-cover bg-center opacity-60"
          style={{ backgroundImage: `url(${level.backdrop})` }}
        />
        <Platformer level={level} />
        <button
          onClick={() => setPlaying(false)}
          className="absolute right-4 top-4 z-20 rounded bg-white/10 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur hover:bg-white/20"
        >
          ✕ Exit play-test
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] w-full flex-col bg-neutral-950 text-white">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-3 py-2 text-xs">
        <span className="font-semibold tracking-wide text-yellow-500/80">
          LEVEL EDITOR
        </span>
        <Sep />
        <Btn onClick={addPlatform}>+ Platform</Btn>
        <Btn onClick={() => addEnemy("templar-knight")}>+ Knight</Btn>
        <Btn onClick={() => addEnemy("templar-guard")}>+ Guard</Btn>
        <Btn onClick={addNpc}>+ NPC</Btn>
        <Btn onClick={addBush}>+ Bush</Btn>
        <Btn onClick={addLadder}>+ Ladder</Btn>
        <Sep />
        <Btn onClick={() => setScale((s) => Math.max(0.2, +(s - 0.1).toFixed(2)))}>
          −
        </Btn>
        <span className="w-10 text-center text-white/50">
          {Math.round(scale * 100)}%
        </span>
        <Btn onClick={() => setScale((s) => Math.min(1.5, +(s + 0.1).toFixed(2)))}>
          +
        </Btn>
        <Sep />
        <label className="flex items-center gap-1 text-white/60">
          <input
            type="checkbox"
            checked={snapOn}
            onChange={(e) => setSnapOn(e.target.checked)}
          />
          snap
        </label>
        <input
          type="number"
          className="w-14 rounded border border-white/15 bg-black/30 px-1.5 py-1"
          value={grid}
          onChange={(e) => setGrid(Math.max(1, parseInt(e.target.value) || 1))}
        />
        <Sep />
        <Btn onClick={() => setPlaying(true)} accent>
          ▶ Play-test
        </Btn>
      </div>

      {/* Body */}
      <div className="flex min-h-0 flex-1">
        {/* Stage */}
        <div className="min-w-0 flex-1">
          <Stage
            level={level}
            scale={scale}
            grid={snapOn ? grid : 1}
            selection={selection}
            onSelect={setSelection}
            patchPlatform={patchPlatform}
            patchEnemy={patchEnemy}
            patchNpc={patchNpc}
            patchBush={patchBush}
            patchLadder={patchLadder}
            patchLevel={patchLevel}
          />
        </div>

        {/* Right panel */}
        <div className="flex w-80 shrink-0 flex-col border-l border-white/10">
          <div className="min-h-0 flex-1 overflow-hidden">
            <Inspector
              level={level}
              selection={selection}
              patchLevel={patchLevel}
              patchPlatform={patchPlatform}
              patchEnemy={patchEnemy}
              patchNpc={patchNpc}
              patchBush={patchBush}
              patchLadder={patchLadder}
              deleteSelected={deleteSelected}
            />
          </div>

          {/* Export / Import */}
          <div className="border-t border-white/10 p-3 text-xs">
            <div className="mb-1 flex items-center justify-between">
              <span className="font-semibold uppercase tracking-wider text-yellow-500/70">
                Export
              </span>
              <Btn onClick={copyTs}>{copied ? "Copied!" : "Copy .ts"}</Btn>
            </div>
            <textarea
              readOnly
              value={tsOut}
              className="h-28 w-full resize-none rounded border border-white/10 bg-black/40 p-2 font-mono text-[10px] text-white/70"
            />
            <div className="mb-1 mt-3 font-semibold uppercase tracking-wider text-yellow-500/70">
              Import (paste JSON or .ts)
            </div>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="Paste a LevelDef here…"
              className="h-20 w-full resize-none rounded border border-white/10 bg-black/40 p-2 font-mono text-[10px]"
            />
            <div className="mt-1 flex items-center gap-2">
              <Btn onClick={doImport}>Load</Btn>
              {importMsg && (
                <span
                  className={
                    importMsg === "Loaded." ? "text-emerald-400" : "text-red-400"
                  }
                >
                  {importMsg}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Btn({
  children,
  onClick,
  accent,
}: {
  children: React.ReactNode;
  onClick: () => void;
  accent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded px-2 py-1 font-medium ${
        accent
          ? "bg-yellow-500/80 text-black hover:bg-yellow-400"
          : "border border-white/15 text-white/80 hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <span className="mx-1 h-4 w-px bg-white/15" />;
}
