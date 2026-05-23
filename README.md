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

A 2000px-wide scrolling world, a smooth-follow camera, five platforms, and one Templar guard patrolling the open stretch. The guard has a vision cone — step into it and `DETECTED` lights up. Sneak up behind him while he's facing away and an `E` prompt appears above his head; press `E` and he drops.

No game-over yet, no respawn — getting spotted is feedback, not failure. Crouch is still cosmetic.

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

You can stealth-kill an enemy when **all** of these are true:

- The enemy is alive.
- You are **behind** them (opposite their facing direction).
- You are within `STEALTH_KILL_RANGE` (55px) horizontally.
- You are on the same floor (within `STEALTH_KILL_Y_TOLERANCE` of `groundY`).

When all conditions hold, a pulsing `E` prompt appears above the enemy. Press `E` and they drop. Dead enemies stop ticking, don't emit vision cones, and stay slumped where they fell.

## What's next

- **Respawn on detection** — caught for >N frames → respawn at level start. Closes the stealth loop.
- **Cover blocks vision** — line-of-sight occluded by walls/crates. Currently the cone is line-only.
- **Climb / ledge grab** — `W` becomes useful.
- **A second enemy type** — archer or brute. Tests whether the engine module is actually reusable.
- **Touch controls** for mobile.
- **Parallax backdrop**, **sprite art**, **level-complete state**.

## Non-goals

Multiplayer. Saved games. Migrating off the browser. Anything that asks the player to commit before they play.
