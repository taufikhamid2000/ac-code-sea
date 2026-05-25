/**
 * Level data types. Engine-agnostic — a LevelDef describes WHAT a level
 * contains; the engine (lib/game/scenes/LevelScene.ts) is responsible
 * for HOW it plays.
 *
 * Coordinates: x is world-space pixels (0 = leftmost). Platform y is
 * stored as `dy` — distance ABOVE the ground line — so platforms
 * re-align when the viewport resizes.
 */

export type PlatformDef = {
  /** World-space x of platform's left edge */
  x: number;
  /** Pixels above the ground line (top of platform = groundY - dy) */
  dy: number;
  w: number;
  h: number;
};

// ===== Enemies =====

type EnemyDefBase = {
  /** Initial facing direction: 1 = right, -1 = left */
  startFacing: 1 | -1;
};

/**
 * The patrolling Templar guard. Stealth content — players sneak past,
 * stealth-kill from behind or above.
 */
export type TemplarGuardDef = EnemyDefBase & {
  kind: "templar-guard";
  patrolMinX: number;
  patrolMaxX: number;
  /** Pixels per frame */
  speed: number;
  /** Frames to pause at each patrol endpoint before turning */
  pauseAtEnds: number;
  /** Vision cone length in pixels */
  visionLength: number;
  /** Half-width of the cone in radians */
  visionHalfAngle: number;
  /** Cone tilt vs. horizontal in radians (positive = looks down) */
  visionCenterAngle: number;
};

/**
 * Stationary combat enemy. The knight cycles through:
 *   idle → telegraph → striking → recovery → idle
 * The player can press the attack button during `telegraph` to parry
 * (stunning the knight) or strike during `idle`/`recovery`.
 *
 * Damage is dealt to the player only during the `striking` frames if
 * the player is within `attackRange`.
 */
export type TemplarKnightDef = EnemyDefBase & {
  kind: "templar-knight";
  /** Fixed world x position. Knight does not move. */
  x: number;
  /** Starting hit points */
  hp: number;
  /** Frames of wind-up (the "tell"). Parryable during this window. */
  attackTelegraphFrames: number;
  /** Frames the strike is "live" — damages player if in range */
  attackStrikeFrames: number;
  /** Frames of recovery after a strike */
  attackRecoveryFrames: number;
  /** Frames of idle between recovery and next telegraph */
  attackIdleFrames: number;
  /** Damage range from knight's x */
  attackRange: number;
  /** Damage dealt to player per strike */
  damage: number;
  /** Frames the knight stays stunned after a parry */
  stunFrames: number;
};

export type EnemyDef = TemplarGuardDef | TemplarKnightDef;
export type EnemyKind = EnemyDef["kind"];

// ===== Levels =====

export type LevelDef = {
  id: string;
  chapter: string;
  title: string;
  worldWidth: number;
  backdrop: string;
  playerSpawn: { x: number };
  /**
   * Cross this x and the level is "complete". Place it past any combat
   * gates so the player must defeat enemies to reach it.
   */
  endTriggerX: number;
  /**
   * Optional opening narration. Shown as a faded overlay at the start
   * of the level. Each entry is a paragraph.
   */
  openingNarration?: string[];
  /**
   * Optional closing narration. Shown after the player crosses
   * endTriggerX, before the LEVEL COMPLETE overlay. Used to land the
   * chapter's emotional beat.
   */
  closingNarration?: string[];
  platforms: PlatformDef[];
  enemies: EnemyDef[];
};
