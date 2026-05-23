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

A 2000px-wide scrolling world with a smooth-follow camera, five platforms with AABB collision, and one Templar guard patrolling the open stretch. The guard has a vision cone — step into it and a red vignette plus a `DETECTED` chip light up. No game-over yet; the feedback is the goal.

Still no climb mechanics, no combat, no respawn-on-detection, no touch controls.

## Stack

- Next.js 13 (pages router)
- HTML5 Canvas, raw 2D context
- React owns the component tree; the game loop is plain `requestAnimationFrame`
- Tailwind for the chrome (title chip, control HUD)

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. Click the canvas so it has focus, then press keys.

## Layout

```
components/game/Platformer.tsx  -> engine: canvas, game loop, physics, draw
lib/levels/types.ts             -> LevelDef / PlatformDef / GuardDef
lib/levels/level01.ts           -> Level 01 data
lib/levels/index.ts             -> barrel export
pages/index.tsx                 -> page chrome + picks the active level
pages/storyline.tsx             -> redirect to /
content/source/                 -> raw narrative source (not bundled)
public/1.png ... 9.png          -> backdrop art (placeholder)
```

The split is deliberate: `Platformer.tsx` is engine code that doesn't know anything about Level 01. It takes a `LevelDef` and runs it. To add Level 02, drop a new file in `lib/levels/` and switch which one `pages/index.tsx` imports.

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
    // ... add more
  ],
  guards: [
    {
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
- Platform `dy` is pixels above the ground line — platforms re-align if the viewport resizes.
- Guard angles are radians: `visionHalfAngle` is half the cone width, `visionCenterAngle` tilts the cone (positive = looks slightly down).

## What's next

- **Climb / ledge grab** — `W` becomes useful, makes high platforms reachable.
- **Cover blocks the cone** — crouching behind a wall = invisible. Currently crouch is cosmetic.
- **Respawn on detection** — caught for >N frames → respawn at level start. Closes the stealth loop.
- **Touch controls** for mobile.
- **Parallax backdrop**, **sprite art**, **level-complete state**.

## Non-goals

Multiplayer. Saved games. Migrating off the browser. Anything that asks the player to commit before they play.
