/**
 * Enemy engine logic. Pure functions over EnemyState + EnemyDef.
 *
 * Reusable on purpose: Platformer.tsx (the canvas/loop) and any future
 * harness (a test rig, a level editor preview) can use these without
 * pulling in the renderer.
 *
 * Design notes:
 *   - Functions mutate the state argument in place when it makes sense
 *     for a per-frame loop (tickEnemy). Read-only checks return values.
 *   - The engine does NOT depend on the canvas or React. Drawing lives
 *     elsewhere.
 *   - Eye/target offsets are tied to the enemy `kind` so different
 *     enemy types can have different sight profiles later.
 */

import type { EnemyDef, EnemyKind } from "@/lib/levels";

export type EnemyState = {
  x: number;
  facing: 1 | -1;
  pauseFrames: number;
  animTime: number;
  /** True after a stealth kill. Stops ticking, sight, and threat. */
  dead: boolean;
  /** Frames since death — for slumping / fade animations. */
  deathTimer: number;
};

/** A point in world space — what the engine needs to test sight against. */
export type SightTarget = {
  /** World-space x */
  x: number;
  /** World-space y of feet (ground-aligned) */
  y: number;
};

/** What the engine needs to test stealth-kill validity against. */
export type StealthKillActor = {
  x: number;
  /** World-space y of feet — used to confirm same-floor targeting. */
  y: number;
};

/**
 * Eye height above ground, by enemy kind.
 * Keeps cone geometry consistent with whatever drawEnemy renders.
 */
const EYE_DY_BY_KIND: Record<EnemyKind, number> = {
  "templar-guard": 36,
};

/** Where on a target the enemy's sight focuses (above feet). */
const SIGHT_TARGET_DY = 20;

/** Ground stealth-kill horizontal range (pixels). */
export const STEALTH_KILL_RANGE = 55;

/** Same-floor tolerance — actor's feet vs. enemy's feet. */
export const STEALTH_KILL_Y_TOLERANCE = 30;

/** Air assassinate horizontal range (pixels). Narrower than ground — you have to aim. */
export const AIR_KILL_RANGE = 42;

/**
 * Minimum vertical separation for an air kill, in pixels. Player's feet
 * must be at least this far ABOVE the enemy's feet.
 */
export const AIR_KILL_MIN_HEIGHT = 35;

/** Discriminates between behind-the-back and drop-from-above kills. */
export type StealthKillKind = "ground" | "air";

export type StealthKillTarget = {
  enemyIdx: number;
  kind: StealthKillKind;
};

export function spawnEnemy(def: EnemyDef): EnemyState {
  return {
    x: def.startFacing === 1 ? def.patrolMinX : def.patrolMaxX,
    facing: def.startFacing,
    pauseFrames: 0,
    animTime: 0,
    dead: false,
    deathTimer: 0,
  };
}

/** Advance one frame of patrol AI. Dead enemies just age their death timer. */
export function tickEnemy(state: EnemyState, def: EnemyDef): void {
  if (state.dead) {
    state.deathTimer++;
    return;
  }
  if (state.pauseFrames > 0) {
    state.pauseFrames--;
    state.animTime = 0;
    return;
  }
  state.x += def.speed * state.facing;
  state.animTime += 0.15;
  if (state.x >= def.patrolMaxX) {
    state.x = def.patrolMaxX;
    state.facing = -1;
    state.pauseFrames = def.pauseAtEnds;
  } else if (state.x <= def.patrolMinX) {
    state.x = def.patrolMinX;
    state.facing = 1;
    state.pauseFrames = def.pauseAtEnds;
  }
}

/** True if `target` is inside this enemy's vision cone. */
export function isInVisionCone(
  state: EnemyState,
  def: EnemyDef,
  target: SightTarget,
  groundY: number
): boolean {
  if (state.dead) return false;

  const eyeX = state.x;
  const eyeY = groundY - EYE_DY_BY_KIND[def.kind];
  const targetX = target.x;
  const targetY = target.y - SIGHT_TARGET_DY;

  const dx = targetX - eyeX;
  const dy = targetY - eyeY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist > def.visionLength) return false;

  // Project into the enemy's forward frame so the same cone math works
  // for either facing direction.
  const forwardDx = dx * state.facing;
  if (forwardDx <= 0) return false; // behind the enemy

  const angle = Math.atan2(dy, forwardDx);
  return Math.abs(angle - def.visionCenterAngle) < def.visionHalfAngle;
}

/**
 * Find the closest enemy the actor can stealth-kill right now, and which
 * KIND of kill applies. Returns null if no enemy qualifies.
 *
 * Two paths to a kill:
 *
 *   Ground kill — "behind the back":
 *     - Enemy alive.
 *     - Actor on the same floor (within STEALTH_KILL_Y_TOLERANCE).
 *     - Actor BEHIND the enemy (opposite the enemy's facing).
 *     - Horizontal distance within STEALTH_KILL_RANGE.
 *
 *   Air kill — "drop from above":
 *     - Enemy alive.
 *     - Actor at least AIR_KILL_MIN_HEIGHT above the enemy's feet.
 *     - Horizontal distance within AIR_KILL_RANGE (narrower — you aim).
 *     - Facing direction of the enemy does NOT matter — enemies don't
 *       look up.
 *
 * Enemy y is currently always groundY (no platform-standing enemies yet).
 * When that changes, replace the `enemyY = groundY` line with each
 * enemy's actual y.
 */
export function findStealthKillTarget(
  actor: StealthKillActor,
  enemies: EnemyState[],
  groundY: number
): StealthKillTarget | null {
  let best: StealthKillTarget | null = null;
  let bestDist = Infinity;

  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    if (e.dead) continue;

    const enemyY = groundY; // see comment above
    const dx = actor.x - e.x;
    const dyDown = actor.y - enemyY; // positive = below, negative = above
    const absDx = Math.abs(dx);

    let kind: StealthKillKind | null = null;

    if (Math.abs(dyDown) < STEALTH_KILL_Y_TOLERANCE) {
      // Same floor — try ground kill rules.
      const isBehind = dx * e.facing < 0;
      if (isBehind && absDx < STEALTH_KILL_RANGE) {
        kind = "ground";
      }
    } else if (dyDown < -AIR_KILL_MIN_HEIGHT) {
      // Actor is meaningfully above — try air kill rules.
      if (absDx < AIR_KILL_RANGE) {
        kind = "air";
      }
    }

    if (kind === null) continue;
    if (absDx < bestDist) {
      bestDist = absDx;
      best = { enemyIdx: i, kind };
    }
  }
  return best;
}

/** Mark an enemy dead. Idempotent. */
export function killEnemy(state: EnemyState): void {
  if (state.dead) return;
  state.dead = true;
  state.deathTimer = 0;
}
