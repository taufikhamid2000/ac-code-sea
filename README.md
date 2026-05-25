# AC · Code SEA

A browser-playable 2D side-scroller, in the spirit of AC Chronicles. The Brotherhood, in pre-colonial Southeast Asia.

No install. No signup. Open the URL, the level loads, you play.

## Current state — Chapter I prototype

| Key | Action |
| --- | --- |
| `A` / `D` | Walk left / right |
| `Shift` (hold) | Sprint |
| `Space` (or `W`) | Jump |
| `S` | Crouch |
| `E` | Strike / parry / stealth kill (context-sensitive) |
| `R` | Restart |

**Chapter I — Siege of Malacca.** Opening narration fades in. Walk right and you'll meet a single Templar knight. He cycles `idle → telegraph → strike → recovery`. Press `E` during his telegraph (sword raised) to parry — he stuns and you get free strikes. Miss the parry and you eat damage (3 HP shown top-right). Drop him and the end marker is yours.

Stealth chapter (Level 01) is still in the repo — `lib/levels/level01.ts`. Swap `ACTIVE_LEVEL` in `pages/index.tsx` to play that instead.

Two enemy kinds shipped:
- `templar-guard` — patrol AI, vision cone, killable from behind or above (stealth)
- `templar-knight` — stationary, attack phase machine, killable via parry + strikes (combat)

## Stack

- Next.js 13 (pages router)
- **Phaser 3** for rendering, physics, scenes, camera, input. Loaded lazily so the initial HTML stays small.
- Tailwind for the page chrome (title chip, control HUD)
- Pure-TS engine module (`lib/engine/enemy.ts`) — Phaser-agnostic, portable to any renderer

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. Click the canvas so it has focus, then press keys.

## Layout

```
components/game/Platformer.tsx  -> React wrapper, lazy-loads Phaser
lib/game/scenes/LevelScene.ts   -> Phaser scene — owns physics, input,
                                   camera, drawing
lib/engine/enemy.ts             -> Pure state + math (renderer-agnostic):
                                   spawnEnemy, tickEnemy,
                                   isInVisionCone, findStealthKillTarget,
                                   killEnemy
lib/levels/types.ts             -> LevelDef, PlatformDef, EnemyDef, EnemyKind
lib/levels/level01.ts           -> Level 01 data
lib/levels/index.ts             -> barrel export
pages/index.tsx                 -> picks the active level, renders chrome
pages/storyline.tsx             -> redirect to /
content/source/                 -> raw narrative source (not bundled)
public/1.png ... 9.png          -> backdrop art (placeholder)
```

The split is deliberate:

- **`lib/engine/`** is pure logic — functions that take state and return state or booleans. No canvas, no React, no Phaser. Survived the Phaser migration unchanged.
- **`lib/levels/`** is data — what's in a level, not how it plays. Also Phaser-agnostic.
- **`lib/game/scenes/`** is the Phaser glue: it consumes a `LevelDef`, drives the pure logic, and translates state into Phaser GameObjects each frame.
- **`components/game/Platformer.tsx`** is the React boundary: a `useEffect` that lazy-imports Phaser, boots a `Phaser.Game`, and tears it down on unmount.

When we add a new enemy type (archer, brute, boss), we add a new value to `EnemyKind`, extend `EnemyDef` if needed, and add a draw method on the scene. `findStealthKillTarget`, `tickEnemy`, and `isInVisionCone` keep working without changes.

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

State machine in `LevelScene`:

```
playing ──spotted ≥ RESPAWN_THRESHOLD──▶ respawning ──fade in done──▶ playing
playing ──x ≥ endTriggerX──────────────▶ complete  ──R pressed────▶ respawning
playing ──R pressed────────────────────▶ respawning
complete ──R pressed───────────────────▶ respawning
```

`respawning` uses Phaser's camera fadeOut/fadeIn — `resetLevel()` runs between the two and brings dead enemies back. Detection decays when you break line of sight (down 2 per frame vs. up 1 per frame), so brief sightings don't immediately kill you.

## What's next

- **Cover blocks vision** — line-of-sight occluded by walls/crates. Currently the cone passes through everything.
- **Climb / ledge grab** — `W` becomes useful.
- **A second enemy type** — archer or brute. Tests whether the engine module is actually reusable.
- **Touch controls** for mobile.
- **Parallax backdrop**, **sprite art**, **per-level music**.

## Non-goals

Multiplayer. Saved games. Migrating off the browser. Anything that asks the player to commit before they play.
