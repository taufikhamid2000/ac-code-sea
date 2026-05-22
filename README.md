# AC · Code SEA

A browser-playable interactive narrative. The Brotherhood, in pre-colonial Southeast Asia. Visual novel × choose-your-own-adventure.

No install. No signup. Open the URL → first frame loads → make a choice → see what happens → reach an ending.

## Demo

Chapter VI — **The Temptation of the Keris.** Hang Tuah. The Keris Taming Sari. A Templar at court and an ISU relic that does not obey time. 5 scenes, 2 branch points, 4 paths converging on a single ending beat.

## Stack

- Next.js 13 (pages router)
- Framer Motion for transitions
- Tailwind for styling
- Typed scene data in `lib/story.ts`

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Layout

```
lib/story.ts                  -> scene tree + branching data
components/game/Game.tsx      -> scene state machine
components/game/Scene.tsx     -> one scene + choice UI
pages/index.tsx               -> game entry (=/)
pages/storyline.tsx           -> redirect to /
content/source/               -> raw narrative source (not bundled)
public/1.png ... 9.png        -> scene backgrounds (placeholder art — see below)
```

## Open items

- **Art.** The 9 PNGs in `public/` are placeholders from the prior fan-site build. The brief calls for one locked-in art style across the whole demo — these need to be regenerated to a single style guide before launch.
- **Storage.** The brief mentioned SQLite for chapter/choice data. For one demo chapter with static branching, that's overkill — `lib/story.ts` is a typed module instead. Swap to SQLite when the content surface grows past what's comfortable to hand-edit.
- **Mobile QA.** Built mobile-first but needs a real-device pass. Target: under 2s load on 4G, one-thumb playable.

## Non-goals

Multi-chapter save states. Achievements. Multiplayer. Migrating off the browser. Anything that asks the player to commit before they play.
