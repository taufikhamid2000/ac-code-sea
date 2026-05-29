import type {
  LevelDef,
  PlatformDef,
  EnemyDef,
  TemplarGuardDef,
  TemplarKnightDef,
} from "@/lib/levels/types";
import type { Selection } from "./model";

type Props = {
  level: LevelDef;
  selection: Selection;
  patchLevel: (patch: Partial<LevelDef>) => void;
  patchPlatform: (i: number, patch: Partial<PlatformDef>) => void;
  patchEnemy: (i: number, patch: Partial<EnemyDef>) => void;
  deleteSelected: () => void;
};

export default function Inspector({
  level,
  selection,
  patchLevel,
  patchPlatform,
  patchEnemy,
  deleteSelected,
}: Props) {
  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-3 text-xs">
      <Section title="World">
        <TextRow
          label="id"
          value={level.id}
          onChange={(v) => patchLevel({ id: v })}
        />
        <TextRow
          label="chapter"
          value={level.chapter}
          onChange={(v) => patchLevel({ chapter: v })}
        />
        <TextRow
          label="title"
          value={level.title}
          onChange={(v) => patchLevel({ title: v })}
        />
        <TextRow
          label="backdrop"
          value={level.backdrop}
          onChange={(v) => patchLevel({ backdrop: v })}
        />
        <NumRow
          label="worldWidth"
          value={level.worldWidth}
          onChange={(v) => patchLevel({ worldWidth: v })}
        />
        <NumRow
          label="endTriggerX"
          value={level.endTriggerX}
          onChange={(v) => patchLevel({ endTriggerX: v })}
        />
        <NumRow
          label="spawn.x"
          value={level.playerSpawn.x}
          onChange={(v) => patchLevel({ playerSpawn: { x: v } })}
        />
      </Section>

      <Section title="Selection">
        {selection === null && <Empty>Nothing selected.</Empty>}

        {selection?.type === "spawn" && <Empty>Player spawn — drag on stage.</Empty>}
        {selection?.type === "endTrigger" && (
          <Empty>End trigger — drag on stage.</Empty>
        )}

        {selection?.type === "platform" &&
          (() => {
            const p = level.platforms[selection.index];
            if (!p) return null;
            const set = (patch: Partial<PlatformDef>) =>
              patchPlatform(selection.index, patch);
            return (
              <>
                <Head>Platform #{selection.index}</Head>
                <NumRow label="x" value={p.x} onChange={(v) => set({ x: v })} />
                <NumRow label="dy" value={p.dy} onChange={(v) => set({ dy: v })} />
                <NumRow label="w" value={p.w} onChange={(v) => set({ w: v })} />
                <NumRow label="h" value={p.h} onChange={(v) => set({ h: v })} />
                <DeleteBtn onClick={deleteSelected} />
              </>
            );
          })()}

        {selection?.type === "enemy" &&
          (() => {
            const e = level.enemies[selection.index];
            if (!e) return null;
            const set = (patch: Partial<EnemyDef>) =>
              patchEnemy(selection.index, patch);
            return e.kind === "templar-knight" ? (
              <KnightForm e={e} idx={selection.index} set={set} del={deleteSelected} />
            ) : (
              <GuardForm e={e} idx={selection.index} set={set} del={deleteSelected} />
            );
          })()}
      </Section>

      <Section title="Opening narration">
        <Narration
          lines={level.openingNarration ?? []}
          onChange={(lines) => patchLevel({ openingNarration: lines })}
        />
      </Section>
      <Section title="Closing narration">
        <Narration
          lines={level.closingNarration ?? []}
          onChange={(lines) => patchLevel({ closingNarration: lines })}
        />
      </Section>
    </div>
  );
}

function KnightForm({
  e,
  idx,
  set,
  del,
}: {
  e: TemplarKnightDef;
  idx: number;
  set: (patch: Partial<EnemyDef>) => void;
  del: () => void;
}) {
  return (
    <>
      <Head>Knight #{idx}</Head>
      <FacingRow value={e.startFacing} onChange={(v) => set({ startFacing: v })} />
      <NumRow label="x" value={e.x} onChange={(v) => set({ x: v })} />
      <NumRow label="dy (height)" value={e.dy ?? 0} onChange={(v) => set({ dy: v })} />
      <NumRow label="hp" value={e.hp} onChange={(v) => set({ hp: v })} />
      <NumRow label="attackRange" value={e.attackRange} onChange={(v) => set({ attackRange: v })} />
      <NumRow label="damage" value={e.damage} onChange={(v) => set({ damage: v })} />
      <NumRow label="telegraphFrames" value={e.attackTelegraphFrames} onChange={(v) => set({ attackTelegraphFrames: v })} />
      <NumRow label="strikeFrames" value={e.attackStrikeFrames} onChange={(v) => set({ attackStrikeFrames: v })} />
      <NumRow label="recoveryFrames" value={e.attackRecoveryFrames} onChange={(v) => set({ attackRecoveryFrames: v })} />
      <NumRow label="idleFrames" value={e.attackIdleFrames} onChange={(v) => set({ attackIdleFrames: v })} />
      <NumRow label="stunFrames" value={e.stunFrames} onChange={(v) => set({ stunFrames: v })} />
      <DeleteBtn onClick={del} />
    </>
  );
}

function GuardForm({
  e,
  idx,
  set,
  del,
}: {
  e: TemplarGuardDef;
  idx: number;
  set: (patch: Partial<EnemyDef>) => void;
  del: () => void;
}) {
  return (
    <>
      <Head>Guard #{idx}</Head>
      <FacingRow value={e.startFacing} onChange={(v) => set({ startFacing: v })} />
      <NumRow label="dy (height)" value={e.dy ?? 0} onChange={(v) => set({ dy: v })} />
      <NumRow label="patrolMinX" value={e.patrolMinX} onChange={(v) => set({ patrolMinX: v })} />
      <NumRow label="patrolMaxX" value={e.patrolMaxX} onChange={(v) => set({ patrolMaxX: v })} />
      <NumRow label="speed" value={e.speed} step={0.1} onChange={(v) => set({ speed: v })} />
      <NumRow label="pauseAtEnds" value={e.pauseAtEnds} onChange={(v) => set({ pauseAtEnds: v })} />
      <NumRow label="visionLength" value={e.visionLength} onChange={(v) => set({ visionLength: v })} />
      <NumRow label="visionHalfAngle" value={e.visionHalfAngle} step={0.01} onChange={(v) => set({ visionHalfAngle: v })} />
      <NumRow label="visionCenterAngle" value={e.visionCenterAngle} step={0.01} onChange={(v) => set({ visionCenterAngle: v })} />
      <DeleteBtn onClick={del} />
    </>
  );
}

function Narration({
  lines,
  onChange,
}: {
  lines: string[];
  onChange: (lines: string[]) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      {lines.map((line, i) => (
        <div key={i} className="flex gap-1">
          <input
            className="w-full rounded border border-white/15 bg-black/30 px-1.5 py-1"
            value={line}
            onChange={(ev) => {
              const next = [...lines];
              next[i] = ev.target.value;
              onChange(next);
            }}
          />
          <button
            className="shrink-0 rounded border border-white/15 px-1.5 text-white/50 hover:text-red-400"
            onClick={() => onChange(lines.filter((_, j) => j !== i))}
          >
            ×
          </button>
        </div>
      ))}
      <button
        className="self-start rounded border border-white/15 px-2 py-0.5 text-white/60 hover:bg-white/10"
        onClick={() => onChange([...lines, ""])}
      >
        + paragraph
      </button>
    </div>
  );
}

// ===== small UI atoms =====

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-yellow-500/70">
        {title}
      </p>
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  );
}

function Head({ children }: { children: React.ReactNode }) {
  return <p className="font-semibold text-white/80">{children}</p>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-white/40">{children}</p>;
}

function TextRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-2">
      <span className="text-white/55">{label}</span>
      <input
        className="w-36 rounded border border-white/15 bg-black/30 px-1.5 py-1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function NumRow({
  label,
  value,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-2">
      <span className="text-white/55">{label}</span>
      <input
        type="number"
        step={step}
        className="w-36 rounded border border-white/15 bg-black/30 px-1.5 py-1"
        value={value}
        onChange={(e) => {
          const n = parseFloat(e.target.value);
          if (!Number.isNaN(n)) onChange(n);
        }}
      />
    </label>
  );
}

function FacingRow({
  value,
  onChange,
}: {
  value: 1 | -1;
  onChange: (v: 1 | -1) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-2">
      <span className="text-white/55">startFacing</span>
      <select
        className="w-36 rounded border border-white/15 bg-black/30 px-1.5 py-1"
        value={value}
        onChange={(e) => onChange(e.target.value === "1" ? 1 : -1)}
      >
        <option value="1">right (1)</option>
        <option value="-1">left (-1)</option>
      </select>
    </label>
  );
}

function DeleteBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="mt-1 self-start rounded border border-red-500/40 px-2 py-1 text-red-400 hover:bg-red-500/10"
    >
      Delete
    </button>
  );
}
