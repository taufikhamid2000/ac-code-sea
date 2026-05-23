# AC · Code SEA

A browser-playable 2D side-scroller, in the spirit of AC Chronicles. The Brotherhood, in pre-colonial Southeast Asia.

No install. No signup. Open the URL, the level loads, you play.

## Current state — Level 01 prototype

| Key | Action |
| --- | --- |
| `A` / `D` | Walk left / right |
| `Shift` (hold) | Sprint |
| `Space` (or `W`) | Jump |
| `S` | Crouch |
| `E` | Stealth kill (when prompt appears) |
| `R` | Restart the level |

A 2000px-wide scrolling world, a smooth-follow camera, five platforms, and one Templar guard patrolling the open stretch. Stay in his vision cone too long and you fade to black and respawn. Reach the end marker on the right and `LEVEL COMPLETE` shows — press `R` to play again. Crouch is still cosmetic; no climb, no cover, no second enemy yet.

## Stack

- Next.js 13 (pages router)
- HTML5 Canvas, raw 2D context
- React owns the component tree; the game loop is plain `requestAnimationFrame`
- Tailwind for the chrome

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. Click the canvas so it has focus, then press keys.

## Layout

```
components/game/Platformer.tsx  -> engine: canvas, game loop, physics, draw
lib/engine/enemy.ts             -> enemy state machine (pure, no canvas)
                                   spawnEnemy, tickEnemy,
                                   isInVisionCone, findStealthKillTarget, killEnemy
lib/levels/types.ts             -> LevelDef, PlatformDef, EnemyDef, EnemyKind
lib/levels/level01.ts           -> Level 01 data
lib/levels/index.ts             -> barrel export
pages/index.tsx                 -> picks the active level, renders chrome
pages/storyline.tsx             -> redirect to /
content/source/                 -> raw narrative source (not bundled)
public/1.png ... 9.png          -> backdrop art (placeholder)
```

The split is deliberate:

- **`lib/engine/`** is pure logic — functions that take state and mutate it. No canvas, no React. Easy to unit-test, easy to call from a different harness later (e.g., a level editor preview).
- **`lib/levels/`** is data — what's in a level, not how it plays.
- **`components/game/Platformer.tsx`** is the engine glue: input → state updates → canvas draw. It calls into `lib/engine/` and consumes `lib/levels/`.

When we add a new enemy type (archer, brute, boss), we add a new value to `EnemyKind`, extend `EnemyDef` if it needs extra fields, and add a draw function. `findStealthKillTarget`, `tickEnemy`, and `isInVisionCone` keep working without changes.

## Adding a new level

1. Create `lib/levels/level02.ts`:

```ts
import type { LevelDef } from "./types";

export const level02: LevelDef = {
  id: "level-02",
  chapter: "Chapter VI",
  title: "Level 02",
  worldWidth: 2400,
  backdrop: "/3.png",
  playerSpawn: { x: 140 },
  platforms: [
    { x: 500, dy: 100, w: 150, h: 14 },
    // ...
  ],
  enemies: [
    {
      kind: "templar-guard",
      patrolMinX: 800,
      patrolMaxX: 1100,
      speed: 1.0,
      startFacing: 1,
      pauseAtEnds: 30,
      visionLength: 220,
      visionHalfAngle: 0.32,
      visionCenterAngle: 0.08,
    },
  ],
};
```

2. Export it from `lib/levels/index.ts`.
3. Point `pages/index.tsx` at it. Later this becomes a chapter selector / sequential loader.

Coordinate notes:
- `x` is world-space pixels (0 = leftmost).
- Platform `dy` is pixels above the ground line — platforms re-align on viewport resize.
- Guard angles are in radians: `visionHalfAngle` is half the cone width, `visionCenterAngle` tilts the cone (positive = looks slightly down).

## Stealth kill rules

Two paths to a kill. The engine returns which one applies, and the prompt above the enemy reflects it:

**Ground kill — "behind the back":**
- Enemy is alive.
- You are on the same floor (within `STEALTH_KILL_Y_TOLERANCE`, 30px).
- You are **behind** them (opposite their facing direction).
- Horizontal distance ≤ `STEALTH_KILL_RANGE` (55px).
- Prompt: a single `E` circle above the enemy.

**Air kill — "drop from above":**
- Enemy is alive.
- You are at least `AIR_KILL_MIN_HEIGHT` (35px) above the enemy's feet.
- Horizontal distance ≤ `AIR_KILL_RANGE` (42px — narrower; you have to aim).
- Facing direction **does not matter** — enemies don't look up.
- Prompt: the `E` circle with a downward chevron above it.
- On press, the player snaps onto the enemy's spot (the satisfying "landed in their place" feel).

Press `E` while the prompt is up and they drop. Dead enemies stop ticking, don't emit vision cones, and stay slumped where they fell.

## Game loop

State machine in Platformer.tsx:

```
playing ──spotted ≥ RESPAWN_THRESHOLD──▶ respawning ──fade in done──▶ playing
playing ──x ≥ endTriggerX──────────────▶ complete  ──R pressed────▶ respawning
playing ──R pressed────────────────────▶ respawning
complete ──R pressed───────────────────▶ respawning
```

`respawning` is a single transition with three sub-stages over `FADE_OUT_FRAMES + FADE_IN_FRAMES` frames (60 by default): fade to black, snap state via `resetLevel()` mid-fade, fade back in. `resetLevel()` brings dead enemies back to life — a respawn is a full level reset.

Detection decays when you break line of sight (down 2 per frame vs. up 1 per frame), so brief sightings don't immediately kill you.

## What's next

- **Cover blocks vision** — line-of-sight occluded by walls/crates. Currently the cone passes through everything.
- **Climb / ledge grab** — `W` becomes useful.
- **A second enemy type** — archer or brute. Tests whether the engine module is actually reusable.
- **Touch controls** for mobile.
- **Parallax backdrop**, **sprite art**, **per-level music**.

## Non-goals

Multiplayer. Saved games. Migrating off the browser. Anything that asks the player to commit before they play.
