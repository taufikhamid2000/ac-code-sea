import type { LevelDef } from "./types";

export const level01: LevelDef = {
  id: "level-01",
  chapter: "Chapter VI",
  title: "Level 01",
  worldWidth: 2000,
  backdrop: "/4.png",
  playerSpawn: { x: 140 },
  platforms: [
    { x: 460, dy: 90, w: 140, h: 14 },
    { x: 700, dy: 160, w: 140, h: 14 },
    { x: 970, dy: 100, w: 140, h: 14 },
    { x: 1270, dy: 200, w: 120, h: 14 },
    { x: 1520, dy: 110, w: 160, h: 14 },
  ],
  enemies: [
    {
      kind: "templar-guard",
      patrolMinX: 820,
      patrolMaxX: 1180,
      speed: 1.1,
      startFacing: 1,
      pauseAtEnds: 30,
      visionLength: 220,
      visionHalfAngle: 0.32,
      visionCenterAngle: 0.08,
    },
  ],
};
