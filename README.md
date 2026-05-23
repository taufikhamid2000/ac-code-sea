# AC · Code SEA

A browser-playable 2D side-scroller, in the spirit of AC Chronicles. The Brotherhood, in pre-colonial Southeast Asia.

No install. No signup. Open the URL, the level loads, you play.

## Current state — basic movement prototype

What works:

| Key | Action |
| --- | --- |
| `A` / `D` | Walk left / right |
| `Shift` (hold) | Sprint |
| `Space` (or `W`) | Jump |
| `S` | Crouch |

The character is a placeholder hooded silhouette drawn on canvas. One screen, one ground line, gravity, walls at the viewport edges. No level scrolling, climb mechanics, stealth, combat, or AI yet.

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

- **Touch controls** for mobile (left/right swipe + tap to jump).
- **Climb / ledge grab** — `W` becomes useful.
- **Level scrolling** — camera follows the player past the viewport edge.
- **Tiles** — replace the single ground line with actual platforms.
- **Sprite art** — the canvas-drawn silhouette is a stand-in.
- **Enemies + stealth cones** — the AC Chronicles core loop.

## Non-goals

Multiplayer. Saved games. Migrating off the browser. Anything that asks the player to commit before they play.
