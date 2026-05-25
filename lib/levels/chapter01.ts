import type { LevelDef } from "./types";

/**
 * Chapter I — Siege of Malacca, 1511.
 *
 * Prototype scope: a flat stretch of wall, a single Templar knight
 * blocking the path, and a parry-or-die combat encounter. The
 * narrative is delivered as opening narration, not branching dialogue.
 */
export const chapter01: LevelDef = {
  id: "chapter-01",
  chapter: "Chapter I",
  title: "Siege of Malacca",
  worldWidth: 1600,
  backdrop: "/1.png", // Temasek/coastal — close enough for the wall-of-Malacca vibe
  playerSpawn: { x: 120 },
  endTriggerX: 1500,
  openingNarration: [
    "Malacca, 1511. The Portuguese fleet darkens the horizon.",
    "Hang Tuah — old now, advisor not warrior — watches from the wall.",
    "Below, a young commander falters against a Templar knight.",
    "He has not the steel for this. You do.",
  ],
  platforms: [], // Flat ground for Chapter I — combat, not parkour
  enemies: [
    {
      kind: "templar-knight",
      x: 1100,
      startFacing: -1, // faces the player approaching from the left
      hp: 3,
      attackTelegraphFrames: 32, // ~0.5s windup — parry window
      attackStrikeFrames: 8, //   ~0.13s live strike
      attackRecoveryFrames: 28, // ~0.45s after-strike pause
      attackIdleFrames: 60, //    ~1s between attacks
      attackRange: 60,
      damage: 1,
      stunFrames: 50, // ~0.8s of opening after a parry or clean hit
    },
  ],
};
