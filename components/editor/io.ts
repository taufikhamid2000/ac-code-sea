import type {
  LevelDef,
  PlatformDef,
  EnemyDef,
  TemplarGuardDef,
  TemplarKnightDef,
} from "@/lib/levels/types";

/**
 * Serialization + defaults for the level editor. Editor state IS a
 * LevelDef, so these helpers only convert to/from text and supply
 * sensible defaults for newly placed objects.
 */

/** The document the editor opens with when there's nothing saved. */
export function emptyLevel(): LevelDef {
  return {
    id: "level-new",
    chapter: "Chapter ?",
    title: "Untitled",
    worldWidth: 1600,
    backdrop: "/chapter01-bg.png",
    playerSpawn: { x: 120 },
    endTriggerX: 1500,
    openingNarration: [],
    closingNarration: [],
    platforms: [],
    enemies: [],
  };
}

export function defaultPlatform(x: number): PlatformDef {
  return { x: Math.round(x), dy: 120, w: 160, h: 24 };
}

export function defaultKnight(x: number): TemplarKnightDef {
  return {
    kind: "templar-knight",
    x: Math.round(x),
    startFacing: -1,
    hp: 3,
    attackTelegraphFrames: 32,
    attackStrikeFrames: 8,
    attackRecoveryFrames: 28,
    attackIdleFrames: 60,
    attackRange: 60,
    damage: 1,
    stunFrames: 50,
  };
}

export function defaultGuard(x: number): TemplarGuardDef {
  const cx = Math.round(x);
  return {
    kind: "templar-guard",
    startFacing: 1,
    patrolMinX: cx - 120,
    patrolMaxX: cx + 120,
    speed: 1.4,
    pauseAtEnds: 40,
    visionLength: 260,
    visionHalfAngle: 0.35,
    visionCenterAngle: 0.12,
  };
}

/** Guards have no single `x`; use the patrol midpoint for placement. */
export function enemyAnchorX(e: EnemyDef): number {
  return e.kind === "templar-knight"
    ? e.x
    : Math.round((e.patrolMinX + e.patrolMaxX) / 2);
}

// ===== Export =====

const camelId = "abcdefghijklmnopqrstuvwxyz";

/** Turn an id like "level-02" into a JS const name like "level02". */
function constName(id: string): string {
  const cleaned = id.replace(/[^a-z0-9]/gi, " ").trim();
  const parts = cleaned.split(/\s+/);
  if (parts.length === 0) return "level";
  return parts
    .map((p, i) =>
      i === 0
        ? p.toLowerCase()
        : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()
    )
    .join("")
    .replace(/[^a-zA-Z0-9]/g, "");
}

/**
 * Emit a ready-to-paste `levelNN.ts` source file. Uses JSON for the
 * data body (valid TS object literal) so field order and nesting are
 * deterministic.
 */
export function toLevelTs(level: LevelDef): string {
  const name = constName(level.id) || "level";
  const body = JSON.stringify(level, null, 2)
    // JSON quotes every key; drop quotes on simple identifier keys for
    // idiomatic TS.
    .replace(/^(\s*)"([a-zA-Z_][a-zA-Z0-9_]*)":/gm, "$1$2:");
  return `import type { LevelDef } from "./types";

export const ${name}: LevelDef = ${body};
`;
}

// ===== Import =====

export type ParseResult =
  | { ok: true; level: LevelDef }
  | { ok: false; error: string };

/**
 * Parse pasted text into a LevelDef. Accepts either raw JSON or a
 * `levelNN.ts` file (we strip the import + `export const x: LevelDef =`
 * wrapper and the trailing semicolon, then JSON.parse the object body).
 */
export function parseLevel(text: string): ParseResult {
  let src = text.trim();
  if (!src) return { ok: false, error: "Nothing to import." };

  // Strip a TS module wrapper if present.
  const exportIdx = src.indexOf("=");
  if (src.startsWith("import") || src.includes("export const")) {
    if (exportIdx === -1)
      return { ok: false, error: "Could not find the level object." };
    src = src.slice(exportIdx + 1).trim();
  }
  src = src.replace(/;\s*$/, "").trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(src);
  } catch {
    // Fall back: tolerate unquoted keys / trailing commas via Function.
    try {
      // eslint-disable-next-line no-new-func
      parsed = Function(`"use strict";return (${src});`)();
    } catch (e) {
      return { ok: false, error: `Invalid level data: ${(e as Error).message}` };
    }
  }

  const err = validateLevel(parsed);
  if (err) return { ok: false, error: err };
  return { ok: true, level: parsed as LevelDef };
}

function validateLevel(v: unknown): string | null {
  if (typeof v !== "object" || v === null) return "Top level must be an object.";
  const l = v as Record<string, unknown>;
  for (const key of ["id", "chapter", "title", "backdrop"] as const) {
    if (typeof l[key] !== "string") return `Missing or invalid "${key}".`;
  }
  for (const key of ["worldWidth", "endTriggerX"] as const) {
    if (typeof l[key] !== "number") return `Missing or invalid "${key}".`;
  }
  if (
    typeof l.playerSpawn !== "object" ||
    l.playerSpawn === null ||
    typeof (l.playerSpawn as Record<string, unknown>).x !== "number"
  )
    return 'Missing or invalid "playerSpawn.x".';
  if (!Array.isArray(l.platforms)) return '"platforms" must be an array.';
  if (!Array.isArray(l.enemies)) return '"enemies" must be an array.';
  for (const e of l.enemies as unknown[]) {
    const kind = (e as Record<string, unknown>)?.kind;
    if (kind !== "templar-knight" && kind !== "templar-guard")
      return `Unknown enemy kind: ${String(kind)}.`;
  }
  return null;
}
