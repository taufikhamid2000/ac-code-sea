import { useEffect, useRef } from "react";
import type {
  LevelDef,
  EnemyDef,
  PlatformDef,
  NpcDef,
  BushDef,
  LadderDef,
} from "@/lib/levels/types";
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
  patchNpc: (i: number, patch: Partial<NpcDef>) => void;
  patchBush: (i: number, patch: Partial<BushDef>) => void;
  patchLadder: (i: number, patch: Partial<LadderDef>) => void;
  patchLevel: (patch: Partial<LevelDef>) => void;
};

const BUSH_DEFAULT_H = 72;

const GUARD_EYE_DY = 46;

type Drag =
  | { kind: "platform-move"; i: number; ox: number; ody: number }
  | { kind: "platform-w"; i: number; ow: number }
  | { kind: "platform-h"; i: number; oh: number }
  | { kind: "enemy-move"; i: number; ox: number; ody: number }
  | { kind: "guard-min"; i: number; omin: number }
  | { kind: "guard-max"; i: number; omax: number }
  | { kind: "npc-move"; i: number; ox: number; ody: number }
  | { kind: "bush-move"; i: number; ox: number; ody: number }
  | { kind: "bush-w"; i: number; ow: number }
  | { kind: "bush-h"; i: number; oh: number }
  | { kind: "ladder-move"; i: number; ox: number; ody: number }
  | { kind: "ladder-w"; i: number; ow: number }
  | { kind: "ladder-h"; i: number; oh: number }
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
  patchNpc,
  patchBush,
  patchLadder,
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
          // Dragging up on screen raises the enemy → larger dy.
          const ndy = Math.max(0, g(d.ody - dyWorld));
          const en = level.enemies[d.i];
          if (en.kind === "templar-knight") patchEnemy(d.i, { x: nx, dy: ndy });
          else {
            const half = (en.patrolMaxX - en.patrolMinX) / 2;
            patchEnemy(d.i, {
              patrolMinX: Math.max(0, Math.round(nx - half)),
              patrolMaxX: Math.round(nx + half),
              dy: ndy,
            });
          }
          break;
        }
        case "npc-move": {
          const nx = Math.max(0, g(d.ox + dxWorld));
          const ndy = Math.max(0, g(d.ody - dyWorld));
          patchNpc(d.i, { x: nx, dy: ndy });
          break;
        }
        case "bush-move": {
          const nx = Math.max(0, g(d.ox + dxWorld));
          const ndy = Math.max(0, g(d.ody - dyWorld));
          patchBush(d.i, { x: nx, dy: ndy });
          break;
        }
        case "bush-w":
          patchBush(d.i, { w: Math.max(24, g(d.ow + dxWorld)) });
          break;
        case "bush-h":
          // Top handle: dragging up (negative dyWorld) grows the bush.
          patchBush(d.i, { h: Math.max(24, g(d.oh - dyWorld)) });
          break;
        case "ladder-move": {
          const nx = Math.max(0, g(d.ox + dxWorld));
          // Allow negative dy so a ladder's base can sit underground.
          const ndy = g(d.ody - dyWorld);
          patchLadder(d.i, { x: nx, dy: ndy });
          break;
        }
        case "ladder-w":
          patchLadder(d.i, { w: Math.max(16, g(d.ow + dxWorld)) });
          break;
        case "ladder-h":
          patchLadder(d.i, { h: Math.max(40, g(d.oh - dyWorld)) });
          break;
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
  }, [
    scale,
    grid,
    level,
    patchPlatform,
    patchEnemy,
    patchNpc,
    patchBush,
    patchLadder,
    patchLevel,
  ]);

  function startDrag(e: React.PointerEvent, d: Drag) {
    e.stopPropagation();
    drag.current = { d, startX: e.clientX, startY: e.clientY };
  }

  const underground = level.undergroundDepth ?? 0;
  const worldH = Math.max(STAGE_WORLD_HEIGHT, GROUND_Y + underground + 60);
  const contentWidth = sx(level.worldWidth);
  const contentHeight = sy(worldH);
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
        {/* Underground area shading */}
        {underground > 0 && (
          <div
            className="absolute inset-x-0 bg-neutral-950"
            style={{ top: groundScreenY, height: sy(underground) }}
          />
        )}
        {/* Ground line */}
        <div
          className="absolute inset-x-0 h-px bg-yellow-500/50"
          style={{ top: groundScreenY }}
        />
        {/* Underground floor line */}
        {underground > 0 && (
          <div
            className="absolute inset-x-0 h-px bg-yellow-500/20"
            style={{ top: groundScreenY + sy(underground) }}
          />
        )}

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
                eyeY={sy(GROUND_Y - GUARD_EYE_DY - (e.dy ?? 0))}
                scale={scale}
                selected={selection?.type === "enemy" && selection.index === i}
              />
            ) : null
          )}
        </svg>

        {/* Ladders */}
        {(level.ladders ?? []).map((l, i) => {
          const sel = selection?.type === "ladder" && selection.index === i;
          const ldy = l.dy ?? 0;
          return (
            <div
              key={i}
              onPointerDown={(e) => {
                onSelect({ type: "ladder", index: i });
                startDrag(e, { kind: "ladder-move", i, ox: l.x, ody: ldy });
              }}
              title="ladder"
              className={`absolute cursor-move border ${
                sel
                  ? "border-yellow-400 bg-amber-500/30"
                  : "border-amber-600/70 bg-amber-700/25"
              }`}
              style={{
                left: sx(l.x),
                top: groundScreenY - sy(ldy) - sy(l.h),
                width: sx(l.w),
                height: sy(l.h),
                backgroundImage:
                  "repeating-linear-gradient(to bottom, transparent 0, transparent 8px, rgba(217,160,90,0.6) 8px, rgba(217,160,90,0.6) 11px)",
              }}
            >
              {sel && (
                <>
                  <Handle
                    pos="right"
                    onPointerDown={(e) =>
                      startDrag(e, { kind: "ladder-w", i, ow: l.w })
                    }
                  />
                  <Handle
                    pos="top"
                    onPointerDown={(e) =>
                      startDrag(e, { kind: "ladder-h", i, oh: l.h })
                    }
                  />
                </>
              )}
            </div>
          );
        })}

        {/* Bushes (hiding spots) */}
        {(level.bushes ?? []).map((b, i) => {
          const sel = selection?.type === "bush" && selection.index === i;
          const bdy = b.dy ?? 0;
          const bh = b.h ?? BUSH_DEFAULT_H;
          return (
            <div
              key={i}
              onPointerDown={(e) => {
                onSelect({ type: "bush", index: i });
                startDrag(e, { kind: "bush-move", i, ox: b.x, ody: bdy });
              }}
              title="bush (hiding spot)"
              className={`absolute cursor-move rounded-t-lg border ${
                sel
                  ? "border-yellow-400 bg-green-500/40"
                  : "border-green-600/60 bg-green-700/35"
              }`}
              style={{
                left: sx(b.x),
                top: groundScreenY - sy(bdy) - sy(bh),
                width: sx(b.w),
                height: sy(bh),
              }}
            >
              {sel && (
                <>
                  <Handle
                    pos="right"
                    onPointerDown={(e) =>
                      startDrag(e, { kind: "bush-w", i, ow: b.w })
                    }
                  />
                  <Handle
                    pos="top"
                    onPointerDown={(e) =>
                      startDrag(e, { kind: "bush-h", i, oh: bh })
                    }
                  />
                </>
              )}
            </div>
          );
        })}

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
          const edy = e.dy ?? 0;
          const isGuard = e.kind === "templar-guard";
          return (
            <div key={i}>
              {isGuard && sel && (
                <>
                  <EndpointFlag
                    x={sx(e.patrolMinX)}
                    groundY={groundScreenY - sy(edy)}
                    onPointerDown={(ev) =>
                      startDrag(ev, { kind: "guard-min", i, omin: e.patrolMinX })
                    }
                  />
                  <EndpointFlag
                    x={sx(e.patrolMaxX)}
                    groundY={groundScreenY - sy(edy)}
                    onPointerDown={(ev) =>
                      startDrag(ev, { kind: "guard-max", i, omax: e.patrolMaxX })
                    }
                  />
                </>
              )}
              <div
                onPointerDown={(ev) => {
                  onSelect({ type: "enemy", index: i });
                  startDrag(ev, { kind: "enemy-move", i, ox: ax, ody: edy });
                }}
                title={e.kind}
                className={`absolute flex -translate-x-1/2 cursor-move items-center justify-center rounded-sm border text-[10px] font-bold ${
                  sel ? "border-yellow-400" : "border-white/60"
                } ${isGuard ? "bg-orange-500/70" : "bg-red-600/70"}`}
                style={{
                  left: sx(ax),
                  top: groundScreenY - sy(edy) - sy(60),
                  width: sx(28),
                  height: sy(60),
                }}
              >
                {isGuard ? "G" : "K"}
              </div>
            </div>
          );
        })}

        {/* NPCs */}
        {(level.npcs ?? []).map((n, i) => {
          const sel = selection?.type === "npc" && selection.index === i;
          const ndy = n.dy ?? 0;
          const color =
            n.role === "rescue"
              ? "bg-sky-400/70"
              : n.role === "talk"
              ? "bg-emerald-300/70"
              : "bg-neutral-300/60";
          return (
            <div
              key={i}
              onPointerDown={(ev) => {
                onSelect({ type: "npc", index: i });
                startDrag(ev, { kind: "npc-move", i, ox: n.x, ody: ndy });
              }}
              title={`${n.role} npc${n.label ? ` — ${n.label}` : ""}`}
              className={`absolute flex -translate-x-1/2 cursor-move flex-col items-center justify-end rounded-sm border text-[10px] font-bold text-black ${
                sel ? "border-yellow-400" : "border-white/60"
              } ${color}`}
              style={{
                left: sx(n.x),
                top: groundScreenY - sy(ndy) - sy(54),
                width: sx(24),
                height: sy(54),
              }}
            >
              <span className="pointer-events-none -mt-4 whitespace-nowrap text-[9px] text-white/80">
                {n.label || n.role}
              </span>
              <span className="mb-1">N</span>
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
  pos: "right" | "bottom" | "top";
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  const cls =
    pos === "right"
      ? "right-0 top-1/2 -translate-y-1/2 translate-x-1/2 cursor-ew-resize"
      : pos === "top"
      ? "top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize"
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
