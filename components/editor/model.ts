/** Shared editor state types + the geometry convention the Stage uses. */

export type Selection =
  | { type: "platform"; index: number }
  | { type: "enemy"; index: number }
  | { type: "npc"; index: number }
  | { type: "bush"; index: number }
  | { type: "ladder"; index: number }
  | { type: "spawn" }
  | { type: "endTrigger" }
  | null;

/**
 * The vertical band (in game pixels) the editor shows. The real game
 * uses the live viewport height; we pick a fixed reference so platform
 * `dy` (pixels above ground) renders consistently here. Ground sits at
 * GROUND_RATIO down from the top — identical to LevelScene.
 */
export const STAGE_WORLD_HEIGHT = 640;
export const GROUND_RATIO = 0.85;
export const GROUND_Y = STAGE_WORLD_HEIGHT * GROUND_RATIO;

export function snap(value: number, grid: number): number {
  if (grid <= 1) return Math.round(value);
  return Math.round(value / grid) * grid;
}
