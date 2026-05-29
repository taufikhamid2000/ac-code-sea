import { useEffect, useRef } from "react";
import type { LevelDef, EnemyDef, PlatformDef } from "@/lib/levels/types";
import { GROUND_Y, STAGE_WORLD_HEIGHT, snap, type Selection } from "./model";
import { enemyAnchorX } from "./io";

type Props = {
  level: LevelDef;
  scale: number;
  grid: number;
  selection: Selection;
  onSelect: (s: Selection) => void;
  patchPlatform: (i: number, patch: Partial<PlatformDef>) => void;
  patchEnemy: (i: number, patch: Partial<EnemyDef>) => void;
  patchLevel: (patch: Partial<LevelDef>) => void;
};

const GUARD_EYE_DY = 46;

type Drag =
  | { kind: "platform-move"; i: number; ox: number; ody: number }
  | { kind: "platform-w"; i: number; ow: number }
  | { kind: "platform-h"; i: number; oh: number }
  | { kind: "enemy-move"; i: number; ox: number }
  | { kind: "guard-min"; i: number; omin: number }
  | { kind: "guard-max"; i: number; omax: number }
  | { kind: "spawn" }
  | { kind: "end" };

export default function Stage({
  level,
  scale,
  grid,
  selection,
  onSelect,
  patchPlatform,
  patchEnemy,
  patchLevel,
}: Props) {
  const drag = useRef<{ d: Drag; startX: number; startY: number } | null>(null);

  // World <-> screen helpers (uniform scale).
  const sx = (worldX: number) => worldX * scale;
  const sy = (worldY: number) => worldY * scale;

  useEffect(() => {
    function onMove(e: PointerEvent) {
      const cur = drag.current;
      if (!cur) return;
      const dxWorld = (e.clientX - cur.startX) / scale;
      const dyWorld = (e.clientY - cur.startY) / scale;
      const d = cur.d;
      const g = (v: number) => snap(v, grid);

      switch (d.kind) {
        case "platform-move":
          patchPlatform(d.i, {
            x: Math.max(0, g(d.ox + dxWorld)),
            // Dragging down on screen lowers the platform → smaller dy.
            dy: g(d.ody - dyWorld),
          });
          break;
        case "platform-w":
          patchPlatform(d.i, { w: Math.max(16, g(d.ow + dxWorld)) });
          break;
        case "platform-h":
          patchPlatform(d.i, { h: Math.max(8, g(d.oh + dyWorld)) });
          break;
        case "enemy-move": {
          const nx = Math.max(0, g(d.ox + dxWorld));
          const en = level.enemies[d.i];
          if (en.kind === "templar-knight") patchEnemy(d.i, { x: nx });
          else {
            const half = (en.patrolMaxX - en.patrolMinX) / 2;
            patchEnemy(d.i, {
              patrolMinX: Math.max(0, Math.round(nx - half)),
              patrolMaxX: Math.round(nx + half),
            });
          }
          break;
        }
        case "guard-min":
          patchEnemy(d.i, { patrolMinX: Math.max(0, g(d.omin + dxWorld)) });
          break;
        case "guard-max":
          patchEnemy(d.i, { patrolMaxX: Math.max(0, g(d.omax + dxWorld)) });
          break;
        case "spawn":
          patchLevel({ playerSpawn: { x: Math.max(0, g(level.playerSpawn.x + dxWorld)) } });
          drag.current = { ...cur, startX: e.clientX };
          break;
        case "end":
          patchLevel({ endTriggerX: Math.max(0, g(level.endTriggerX + dxWorld)) });
          drag.current = { ...cur, startX: e.clientX };
          break;
      }
    }
    function onUp() {
      drag.current = null;
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [scale, grid, level, patchPlatform, patchEnemy, patchLevel]);

  function startDrag(e: React.PointerEvent, d: Drag) {
    e.stopPropagation();
    drag.current = { d, startX: e.clientX, startY: e.clientY };
  }

  const contentWidth = sx(level.worldWidth);
  const contentHeight = sy(STAGE_WORLD_HEIGHT);
  const groundScreenY = sy(GROUND_Y);

  return (
    <div className="relative h-full w-full overflow-auto bg-neutral-900">
      <div
        className="relative"
        style={{ width: contentWidth, height: contentHeight }}
        onPointerDown={() => onSelect(null)}
      >
        {/* Sky / ground bands */}
        <div
          className="absolute inset-x-0 top-0 bg-gradient-to-b from-sky-950/40 to-neutral-900"
          style={{ height: groundScreenY }}
        />
        <div
          className="absolute inset-x-0 bg-neutral-800"
          style={{ top: groundScreenY, bottom: 0 }}
        />
        {/* Ground line */}
        <div
          className="absolute inset-x-0 h-px bg-yellow-500/50"
          style={{ top: groundScreenY }}
        />

        {/* Vision cones (SVG overlay) */}
        <svg
          className="pointer-events-none absolute inset-0"
          width={contentWidth}
          height={contentHeight}
        >
          {level.enemies.map((e, i) =>
            e.kind === "templar-guard" ? (
              <ConePolygon
                key={i}
                guard={e}
                cx={sx(enemyAnchorX(e))}
                eyeY={sy(GROUND_Y - GUARD_EYE_DY)}
                scale={scale}
                selected={selection?.type === "enemy" && selection.index === i}
              />
            ) : null
          )}
        </svg>

        {/* Platforms */}
        {level.platforms.map((p, i) => {
          const sel = selection?.type === "platform" && selection.index === i;
          return (
            <div
              key={i}
              onPointerDown={(e) => {
                onSelect({ type: "platform", index: i });
                startDrag(e, { kind: "platform-move", i, ox: p.x, ody: p.dy });
              }}
              className={`absolute cursor-move border ${
                sel
                  ? "border-yellow-400 bg-yellow-400/30"
                  : "border-emerald-400/60 bg-emerald-400/20"
              }`}
              style={{
                left: sx(p.x),
                top: sy(GROUND_Y - p.dy),
                width: sx(p.w),
                height: sy(p.h),
              }}
            >
              {sel && (
                <>
                  <Handle
                    pos="right"
                    onPointerDown={(e) =>
                      startDrag(e, { kind: "platform-w", i, ow: p.w })
                    }
                  />
                  <Handle
                    pos="bottom"
                    onPointerDown={(e) =>
                      startDrag(e, { kind: "platform-h", i, oh: p.h })
                    }
                  />
                </>
              )}
            </div>
          );
        })}

        {/* Enemies */}
        {level.enemies.map((e, i) => {
          const sel = selection?.type === "enemy" && selection.index === i;
          const ax = enemyAnchorX(e);
          const isGuard = e.kind === "templar-guard";
          return (
            <div key={i}>
              {isGuard && sel && (
                <>
                  <EndpointFlag
                    x={sx(e.patrolMinX)}
                    groundY={groundScreenY}
                    onPointerDown={(ev) =>
                      startDrag(ev, { kind: "guard-min", i, omin: e.patrolMinX })
                    }
                  />
                  <EndpointFlag
                    x={sx(e.patrolMaxX)}
                    groundY={groundScreenY}
                    onPointerDown={(ev) =>
                      startDrag(ev, { kind: "guard-max", i, omax: e.patrolMaxX })
                    }
                  />
                </>
              )}
              <div
                onPointerDown={(ev) => {
                  onSelect({ type: "enemy", index: i });
                  startDrag(ev, { kind: "enemy-move", i, ox: ax });
                }}
                title={e.kind}
                className={`absolute flex -translate-x-1/2 cursor-move items-center justify-center rounded-sm border text-[10px] font-bold ${
                  sel ? "border-yellow-400" : "border-white/60"
                } ${isGuard ? "bg-orange-500/70" : "bg-red-600/70"}`}
                style={{
                  left: sx(ax),
                  top: groundScreenY - sy(60),
                  width: sx(28),
                  height: sy(60),
                }}
              >
                {isGuard ? "G" : "K"}
              </div>
            </div>
          );
        })}

        {/* Spawn marker */}
        <Flag
          x={sx(level.playerSpawn.x)}
          groundY={groundScreenY}
          label="SPAWN"
          color="bg-sky-500"
          selected={selection?.type === "spawn"}
          onPointerDown={(e) => {
            onSelect({ type: "spawn" });
            startDrag(e, { kind: "spawn" });
          }}
        />
        {/* End trigger marker */}
        <Flag
          x={sx(level.endTriggerX)}
          groundY={groundScreenY}
          label="END"
          color="bg-fuchsia-500"
          selected={selection?.type === "endTrigger"}
          onPointerDown={(e) => {
            onSelect({ type: "endTrigger" });
            startDrag(e, { kind: "end" });
          }}
        />
      </div>
    </div>
  );
}

function Handle({
  pos,
  onPointerDown,
}: {
  pos: "right" | "bottom";
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  const cls =
    pos === "right"
      ? "right-0 top-1/2 -translate-y-1/2 translate-x-1/2 cursor-ew-resize"
      : "bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 cursor-ns-resize";
  return (
    <div
      onPointerDown={onPointerDown}
      className={`absolute h-3 w-3 rounded-full border border-black bg-yellow-300 ${cls}`}
    />
  );
}

function Flag({
  x,
  groundY,
  label,
  color,
  selected,
  onPointerDown,
}: {
  x: number;
  groundY: number;
  label: string;
  color: string;
  selected: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  return (
    <div
      onPointerDown={onPointerDown}
      className="absolute flex -translate-x-1/2 cursor-ew-resize flex-col items-center"
      style={{ left: x, top: groundY - 96 }}
    >
      <span
        className={`rounded px-1 text-[9px] font-bold tracking-wider text-white ${color} ${
          selected ? "ring-2 ring-yellow-300" : ""
        }`}
      >
        {label}
      </span>
      <div className={`h-24 w-px ${color}`} />
    </div>
  );
}

function EndpointFlag({
  x,
  groundY,
  onPointerDown,
}: {
  x: number;
  groundY: number;
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  return (
    <div
      onPointerDown={onPointerDown}
      className="absolute z-10 -translate-x-1/2 cursor-ew-resize"
      style={{ left: x, top: groundY - 70 }}
    >
      <div className="h-16 w-px bg-orange-300" />
      <div className="-ml-1 h-2 w-2 rounded-full border border-black bg-orange-300" />
    </div>
  );
}

function ConePolygon({
  guard,
  cx,
  eyeY,
  scale,
  selected,
}: {
  guard: Extract<EnemyDef, { kind: "templar-guard" }>;
  cx: number;
  eyeY: number;
  scale: number;
  selected: boolean;
}) {
  const f = guard.startFacing;
  const len = guard.visionLength * scale;
  const a1 = guard.visionCenterAngle - guard.visionHalfAngle;
  const a2 = guard.visionCenterAngle + guard.visionHalfAngle;
  const p1 = [cx + f * Math.cos(a1) * len, eyeY + Math.sin(a1) * len];
  const p2 = [cx + f * Math.cos(a2) * len, eyeY + Math.sin(a2) * len];
  return (
    <polygon
      points={`${cx},${eyeY} ${p1[0]},${p1[1]} ${p2[0]},${p2[1]}`}
      fill={selected ? "rgba(250,204,21,0.22)" : "rgba(251,146,60,0.15)"}
      stroke={selected ? "rgba(250,204,21,0.6)" : "rgba(251,146,60,0.4)"}
      strokeWidth={1}
    />
  );
}
