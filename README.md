# AC · Code SEA

A browser-playable 2D side-scroller, in the spirit of AC Chronicles. The Brotherhood, in pre-colonial Southeast Asia.

No install. No signup. Open the URL, the level loads, you play.

## Current state — Level 01 prototype

What works:

| Key | Action |
| --- | --- |
| `A` / `D` | Walk left / right |
| `Shift` (hold) | Sprint |
| `Space` (or `W`) | Jump |
| `S` | Crouch |

A 2000px-wide world with a smooth-follow camera. Five platforms at varying heights — landing, sides, and head-bonks all collide properly. Subtle ground line with tick marks for spatial reference, glowing end marker at the far right. Character is still a placeholder hooded silhouette drawn on canvas.

No climb mechanics, stealth, combat, AI, or touch controls yet.

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
components/game/Platformer.tsx  -> canvas + game loop + character
pages/index.tsx                 -> page chrome: backdrop, title, HUD
pages/storyline.tsx             -> redirect to /
content/source/                 -> raw narrative source (not bundled)
public/1.png ... 9.png          -> backdrop art (placeholder)
```

## What's next

Building this out incrementally, not all at once. Likely next moves:

- **A guard with a vision cone** — start the stealth loop, give the level a goal.
- **Climb / ledge grab** — `W` becomes useful, makes platforms reachable from below.
- **Touch controls** for mobile (left/right swipe + tap to jump).
- **Parallax backdrop** — multiple background layers for depth.
- **Sprite art** — the canvas-drawn silhouette is a stand-in.
- **Level-complete state** — reaching the end marker triggers something.

## Non-goals

Multiplayer. Saved games. Migrating off the browser. Anything that asks the player to commit before they play.
