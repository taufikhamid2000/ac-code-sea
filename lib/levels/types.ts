/**
 * Level data types. Engine-agnostic — a LevelDef describes WHAT a level
 * contains; the engine (components/game/Platformer.tsx) is responsible for
 * HOW it plays.
 *
 * Coordinates: x is world-space pixels (0 = leftmost). y for platforms is
 * stored as `dy` — distance ABOVE the ground line, so platforms re-align
 * when the viewport resizes (the ground line is a ratio of viewport
 * height, not an absolute y).
 */

export type PlatformDef = {
  /** World-space x of platform's left edge */
  x: number;
  /** Pixels above the ground line (top of platform = groundY - dy) */
  dy: number;
  /** Width in pixels */
  w: number;
  /** Height in pixels */
  h: number;
};

export type GuardDef = {
  /** Patrol range — guard paces between these two world-space x values */
  patrolMinX: number;
  patrolMaxX: number;
  /** Pixels per frame */
  speed: number;
  /** Initial facing direction: 1 = right, -1 = left */
  startFacing: 1 | -1;
  /** Frames to pause at each patrol endpoint before turning */
  pauseAtEnds: number;
  /** Vision cone length in pixels (line-of-sight distance) */
  visionLength: number;
  /**
   * Half-width of the cone in radians. Total cone angle = 2 * visionHalfAngle.
   * E.g. 0.3 rad ≈ 17° per side, so a ~34° wide cone.
   */
  visionHalfAngle: number;
  /**
   * Angle the cone's centerline makes with horizontal, in radians.
   * 0 = looking straight ahead. Positive = looking slightly down (canvas y+).
   */
  visionCenterAngle: number;
};

export type LevelDef = {
  /** Stable identifier, e.g. "level-01" */
  id: string;
  /** Chapter label shown in HUD, e.g. "Chapter VI" */
  chapter: string;
  /** Short title shown in HUD */
  title: string;
  /** Total world width in pixels */
  worldWidth: number;
  /** Background image (served from /public) */
  backdrop: string;
  /** Where the player spawns. y is always on the ground. */
  playerSpawn: { x: number };
  platforms: PlatformDef[];
  guards: GuardDef[];
};
