/**
 * Shared virtual input state for on-screen (touch) controls. The Phaser
 * scene reads these flags alongside the keyboard, and the DOM overlay
 * (components/game/TouchControls) writes them on pointer events. A module
 * singleton keeps the two in sync without ref plumbing.
 *
 * Held buttons set booleans; the action button is edge-triggered via
 * `actionPressed`, which the scene consumes (sets back to false).
 */
export type TouchState = {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  sprint: boolean;
  actionPressed: boolean;
};

export const touchControls: TouchState = {
  left: false,
  right: false,
  up: false,
  down: false,
  sprint: false,
  actionPressed: false,
};

export function resetTouchControls(): void {
  touchControls.left = false;
  touchControls.right = false;
  touchControls.up = false;
  touchControls.down = false;
  touchControls.sprint = false;
  touchControls.actionPressed = false;
}
