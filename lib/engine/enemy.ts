/**
 * Enemy engine logic. Pure functions over EnemyState + EnemyDef.
 *
 * Reusable on purpose: Phaser scenes and any future harness (test rig,
 * level editor preview) can use these without pulling in the renderer.
 *
 * Design notes:
 *   - Functions mutate the state argument when it makes sense for a
 *     per-frame loop (tickEnemy). Read-only checks return values.
 *   - The engine does NOT depend on the canvas, Phaser, or React.
 *   - Eye/target offsets are keyed by enemy kind so different enemy
 *     types can have different sight profiles.
 */

import type {
  EnemyDef,
  EnemyKind,
  TemplarGuardDef,
  TemplarKnightDef,
} from "@/lib/levels";

// ===== State =====

type EnemyStateBase = {
  x: number;
  /** Pixels above the ground line the enemy stands on (0 = ground). */
  dy: number;
  facing: 1 | -1;
  animTime: number;
  /** True after a kill. Stops ticking, sight, and threat. */
  dead: boolean;
  /** Frames since death — for slumping / fade animations. */
  deathTimer: number;
};

export type TemplarGuardState = EnemyStateBase & {
  kind: "templar-guard";
  /** Frames remaining in the pause-at-patrol-endpoint */
  pauseFrames: number;
};

export type CombatPhase =
  | "idle"
  | "telegraph"
  | "striking"
  | "recovery"
  | "stunned";

export type TemplarKnightState = EnemyStateBase & {
  kind: "templar-knight";
  hp: number;
  combatPhase: CombatPhase;
  /** Frames spent in the current combat phase */
  combatPhaseFrame: number;
};

export type EnemyState = TemplarGuardState | TemplarKnightState;

/** Position/feet shape used for sight checks and stealth-kill rules. */
export type SightTarget = { x: number; y: number };
export type StealthKillActor = { x: number; y: number };

// ===== Constants =====

const EYE_DY_BY_KIND: Record<EnemyKind, number> = {
  "templar-guard": 36,
  "templar-knight": 36, // unused (knight has no cone) but kept for completeness
};

const SIGHT_TARGET_DY = 20;

export const STEALTH_KILL_RANGE = 55;
export const STEALTH_KILL_Y_TOLERANCE = 30;
export const AIR_KILL_RANGE = 42;
export const AIR_KILL_MIN_HEIGHT = 35;

export type StealthKillKind = "ground" | "air";
export type StealthKillTarget = {
  enemyIdx: number;
  kind: StealthKillKind;
};

// ===== Spawn =====

export function spawnEnemy(def: EnemyDef): EnemyState {
  if (def.kind === "templar-guard") {
    return spawnTemplarGuard(def);
  }
  return spawnTemplarKnight(def);
}

function spawnTemplarGuard(def: TemplarGuardDef): TemplarGuardState {
  return {
    kind: "templar-guard",
    x: def.startFacing === 1 ? def.patrolMinX : def.patrolMaxX,
    dy: def.dy ?? 0,
    facing: def.startFacing,
    pauseFrames: 0,
    animTime: 0,
    dead: false,
    deathTimer: 0,
  };
}

function spawnTemplarKnight(def: TemplarKnightDef): TemplarKnightState {
  return {
    kind: "templar-knight",
    x: def.x,
    dy: def.dy ?? 0,
    facing: def.startFacing,
    animTime: 0,
    dead: false,
    deathTimer: 0,
    hp: def.hp,
    combatPhase: "idle",
    combatPhaseFrame: 0,
  };
}

// ===== Tick =====

export function tickEnemy(state: EnemyState, def: EnemyDef): void {
  if (state.dead) {
    state.deathTimer++;
    return;
  }
  if (state.kind === "templar-guard" && def.kind === "templar-guard") {
    tickTemplarGuard(state, def);
  } else if (state.kind === "templar-knight" && def.kind === "templar-knight") {
    tickTemplarKnight(state, def);
  }
}

function tickTemplarGuard(s: TemplarGuardState, d: TemplarGuardDef): void {
  if (s.pauseFrames > 0) {
    s.pauseFrames--;
    s.animTime = 0;
    return;
  }
  s.x += d.speed * s.facing;
  s.animTime += 0.15;
  if (s.x >= d.patrolMaxX) {
    s.x = d.patrolMaxX;
    s.facing = -1;
    s.pauseFrames = d.pauseAtEnds;
  } else if (s.x <= d.patrolMinX) {
    s.x = d.patrolMinX;
    s.facing = 1;
    s.pauseFrames = d.pauseAtEnds;
  }
}

/**
 * Advance the combat phase machine: idle → telegraph → striking →
 * recovery → idle. Stunned interrupts and replaces the current cycle.
 *
 * Damage application (when in `striking` and player is in range) is
 * handled by the scene — this function just advances phases.
 */
function tickTemplarKnight(s: TemplarKnightState, d: TemplarKnightDef): void {
  s.combatPhaseFrame++;
  s.animTime += 0.12;

  switch (s.combatPhase) {
    case "idle":
      if (s.combatPhaseFrame >= d.attackIdleFrames) {
        s.combatPhase = "telegraph";
        s.combatPhaseFrame = 0;
      }
      break;
    case "telegraph":
      if (s.combatPhaseFrame >= d.attackTelegraphFrames) {
        s.combatPhase = "striking";
        s.combatPhaseFrame = 0;
      }
      break;
    case "striking":
      if (s.combatPhaseFrame >= d.attackStrikeFrames) {
        s.combatPhase = "recovery";
        s.combatPhaseFrame = 0;
      }
      break;
    case "recovery":
      if (s.combatPhaseFrame >= d.attackRecoveryFrames) {
        s.combatPhase = "idle";
        s.combatPhaseFrame = 0;
      }
      break;
    case "stunned":
      if (s.combatPhaseFrame >= d.stunFrames) {
        s.combatPhase = "idle";
        s.combatPhaseFrame = 0;
      }
      break;
  }
}

// ===== Vision (templar-guard only) =====

export function isInVisionCone(
  state: EnemyState,
  def: EnemyDef,
  target: SightTarget,
  groundY: number
): boolean {
  if (state.dead) return false;
  if (state.kind !== "templar-guard" || def.kind !== "templar-guard") {
    return false; // knights don't have vision cones
  }

  const eyeX = state.x;
  const eyeY = groundY - state.dy - EYE_DY_BY_KIND[state.kind];
  const targetX = target.x;
  const targetY = target.y - SIGHT_TARGET_DY;

  const dx = targetX - eyeX;
  const dy = targetY - eyeY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist > def.visionLength) return false;

  const forwardDx = dx * state.facing;
  if (forwardDx <= 0) return false;

  const angle = Math.atan2(dy, forwardDx);
  return Math.abs(angle - def.visionCenterAngle) < def.visionHalfAngle;
}

// ===== Stealth kill (templar-guard only) =====

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
    // Stealth-kill applies only to patrol/stealth enemies. Combat
    // enemies (knights) need to be fought in their own loop.
    if (e.kind !== "templar-guard") continue;

    const enemyY = groundY - e.dy;
    const dx = actor.x - e.x;
    const dyDown = actor.y - enemyY;
    const absDx = Math.abs(dx);

    let kind: StealthKillKind | null = null;
    if (Math.abs(dyDown) < STEALTH_KILL_Y_TOLERANCE) {
      const isBehind = dx * e.facing < 0;
      if (isBehind && absDx < STEALTH_KILL_RANGE) kind = "ground";
    } else if (dyDown < -AIR_KILL_MIN_HEIGHT) {
      if (absDx < AIR_KILL_RANGE) kind = "air";
    }

    if (kind === null) continue;
    if (absDx < bestDist) {
      bestDist = absDx;
      best = { enemyIdx: i, kind };
    }
  }
  return best;
}

export function killEnemy(state: EnemyState): void {
  if (state.dead) return;
  state.dead = true;
  state.deathTimer = 0;
}

// ===== Combat helpers (templar-knight) =====

/** True if the actor is within melee range of the knight. */
export function isInMeleeRange(
  actor: { x: number },
  knight: TemplarKnightState,
  def: TemplarKnightDef
): boolean {
  return Math.abs(actor.x - knight.x) <= def.attackRange;
}

/**
 * Apply a player strike to a knight if in range. Returns true if a hit
 * was registered. Does nothing while the knight is mid-strike (you
 * can't trade hits with a swinging blade — parry first).
 */
export function applyPlayerStrike(
  actor: { x: number },
  knight: TemplarKnightState,
  def: TemplarKnightDef,
  damage: number = 1
): boolean {
  if (knight.dead) return false;
  if (!isInMeleeRange(actor, knight, def)) return false;
  if (knight.combatPhase === "striking") return false;

  knight.hp -= damage;
  if (knight.hp <= 0) {
    killEnemy(knight);
  } else {
    // Stagger briefly on a clean hit
    knight.combatPhase = "stunned";
    knight.combatPhaseFrame = 0;
  }
  return true;
}

/**
 * Attempt a parry on a knight in telegraph. Returns true on success
 * (knight is now stunned). Failed parries (no enemy in telegraph) just
 * return false — the caller decides whether to fall through to a
 * regular strike.
 */
export function tryParry(
  actor: { x: number },
  knight: TemplarKnightState,
  def: TemplarKnightDef
): boolean {
  if (knight.dead) return false;
  if (knight.combatPhase !== "telegraph") return false;
  if (!isInMeleeRange(actor, knight, def)) return false;

  knight.combatPhase = "stunned";
  knight.combatPhaseFrame = 0;
  return true;
}

/**
 * If the knight is currently striking, returns true when the actor is
 * in the damage zone. The scene applies player damage based on this.
 */
export function knightStrikeHits(
  actor: { x: number },
  knight: TemplarKnightState,
  def: TemplarKnightDef
): boolean {
  if (knight.dead) return false;
  if (knight.combatPhase !== "striking") return false;
  // Only the first frame of the strike registers, otherwise damage
  // repeats every frame the player stays in range.
  if (knight.combatPhaseFrame !== 0) return false;
  return isInMeleeRange(actor, knight, def);
}
