import Phaser from "phaser";
import type {
  EnemyDef,
  LevelDef,
  TemplarKnightDef,
} from "@/lib/levels";
import {
  type EnemyState,
  type TemplarGuardState,
  type TemplarKnightState,
  applyPlayerStrike,
  findStealthKillTarget,
  isInVisionCone,
  killEnemy,
  knightStrikeHits,
  spawnEnemy,
  tickEnemy,
  tryParry,
} from "@/lib/engine/enemy";
import { GameAudio } from "@/lib/game/audio";

/**
 * The level scene. One scene runs a single LevelDef end-to-end.
 *
 * Reusable parts that stayed agnostic to the renderer:
 *   - lib/levels/*        : data
 *   - lib/engine/enemy.ts : pure state + math (patrol, vision, kill rules,
 *                            combat phases)
 *
 * Drawing strategy: each entity has an invisible Rectangle as its
 * physics body and a Graphics overlay redrawn every frame. When sprite
 * art lands, the Graphics calls swap to Sprite + animations.
 */

// ===== Tuning =====
const GRAVITY_Y = 2520;
const JUMP_VEL_Y = -780;
const WALK_SPEED = 180;
const RUN_SPEED = 330;
const GROUND_RATIO = 0.85;
const CAMERA_LERP = 0.12;

const P_BODY_W = 18;
const P_BODY_H = 50;
const P_HALF_H = P_BODY_H / 2;

const GUARD_EYE_DY = 36;

const RESPAWN_THRESHOLD = 50;
const FADE_MS = 500;
const MAX_PLAYER_HP = 3;
const NARRATION_MS = 6000;
const OUTRO_MS = 6500;

// Cannon timing range — random pick between these each cycle
const CANNON_MIN_MS = 2800;
const CANNON_MAX_MS = 5200;
// Slow-motion duration after a kill
const KILL_SLOWMO_MS = 280;
const KILL_SLOWMO_SCALE = 0.3;

type Phase = "playing" | "respawning" | "outro" | "complete";

type ArcadeRect = Phaser.GameObjects.Rectangle & {
  body: Phaser.Physics.Arcade.Body;
};

type Keys = {
  a: Phaser.Input.Keyboard.Key;
  d: Phaser.Input.Keyboard.Key;
  w: Phaser.Input.Keyboard.Key;
  s: Phaser.Input.Keyboard.Key;
  shift: Phaser.Input.Keyboard.Key;
  space: Phaser.Input.Keyboard.Key;
};

export class LevelScene extends Phaser.Scene {
  private readonly levelDef: LevelDef;

  private groundY = 0;
  private staticBodies!: Phaser.Physics.Arcade.StaticGroup;

  // Player
  private player!: ArcadeRect;
  private playerFx!: Phaser.GameObjects.Graphics;
  private playerFacing: 1 | -1 = 1;
  private playerCrouching = false;
  private playerAnimTime = 0;
  private playerHp = MAX_PLAYER_HP;
  private playerHitFlashUntil = 0;
  /** performance.now() timestamp at which the attack-thrust animation ends */
  private playerAttackUntil = 0;

  // Enemies
  private enemyStates: EnemyState[] = [];
  private enemyFx: Phaser.GameObjects.Graphics[] = [];
  private coneFx: Phaser.GameObjects.Graphics[] = [];

  // UI
  private promptFx!: Phaser.GameObjects.Graphics;
  private promptText!: Phaser.GameObjects.Text;
  private detectionFx!: Phaser.GameObjects.Graphics;
  private detectionText!: Phaser.GameObjects.Text;
  private hpText!: Phaser.GameObjects.Text;
  private narrationContainer!: Phaser.GameObjects.Container;
  private outroContainer!: Phaser.GameObjects.Container;
  private completeContainer!: Phaser.GameObjects.Container;

  // Cannons (atmospheric)
  private flashOverlay!: Phaser.GameObjects.Rectangle;
  private cannonTimerMs = 0;
  private nextCannonAtMs = 0;

  // Particles
  private hitSparksFx!: Phaser.GameObjects.Graphics;
  private hitSparks: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
  }> = [];

  // Audio
  private audio: GameAudio | null = null;
  private prevLegSinSign = 0;
  private wasGrounded = false;
  private slowMoEndAt = 0;

  // Loop state
  private phase: Phase = "playing";
  private detectionFrames = 0;
  private keys!: Keys;

  constructor(level: LevelDef) {
    super({ key: "LevelScene" });
    this.levelDef = level;
  }

  create() {
    const h = this.scale.height;
    this.groundY = h * GROUND_RATIO;

    this.physics.world.gravity.y = GRAVITY_Y;
    this.physics.world.setBounds(0, 0, this.levelDef.worldWidth, h);

    this.staticBodies = this.physics.add.staticGroup();

    this.buildGround();
    this.buildPlatforms();
    this.buildEndMarker();
    this.buildPlayer();
    this.physics.add.collider(this.player, this.staticBodies);

    this.buildEnemies();
    this.buildOverlays();
    this.bindInput();
    this.bindCamera();
    this.bindAudio();

    this.scheduleNextCannon();

    this.scale.on("resize", this.handleResize, this);

    if (this.levelDef.openingNarration?.length) {
      this.showNarration();
    }
  }

  private bindAudio() {
    // Phaser's WebAudio sound manager exposes the AudioContext we need
    // for procedural synthesis. If WebAudio isn't available (rare), we
    // simply skip audio — the optional chain (this.audio?.foo()) handles it.
    const sm = this.sound;
    if (sm instanceof Phaser.Sound.WebAudioSoundManager) {
      this.audio = new GameAudio(sm.context);
    }
  }

  private scheduleNextCannon() {
    this.cannonTimerMs = 0;
    this.nextCannonAtMs =
      CANNON_MIN_MS + Math.random() * (CANNON_MAX_MS - CANNON_MIN_MS);
  }

  // ===== Build =====

  private buildGround() {
    const w = this.levelDef.worldWidth;
    this.add.rectangle(w / 2, this.groundY, w, 1, 0xeab308, 0.35);

    const ticks = this.add.graphics();
    ticks.fillStyle(0xeab308, 0.12);
    for (let x = 0; x <= w; x += 100) {
      ticks.fillRect(x, this.groundY + 2, 1, 4);
    }

    const floor = this.add.rectangle(
      w / 2,
      this.groundY + 100,
      w,
      200,
      0x000000,
      0
    );
    this.physics.add.existing(floor, true);
    this.staticBodies.add(floor);
  }

  private buildPlatforms() {
    for (const p of this.levelDef.platforms) {
      const cx = p.x + p.w / 2;
      const cy = this.groundY - p.dy + p.h / 2;
      const rect = this.add.rectangle(cx, cy, p.w, p.h, 0x0f0f0f, 0.92);
      this.physics.add.existing(rect, true);
      this.staticBodies.add(rect);
      this.add.rectangle(
        cx,
        this.groundY - p.dy + 0.5,
        p.w,
        1,
        0xeab308,
        0.55
      );
    }
  }

  private buildEndMarker() {
    const x = this.levelDef.worldWidth - 40;
    const g = this.add.graphics();
    for (let i = 0; i < 20; i++) {
      g.fillStyle(0xeab308, 0.025 + (i / 20) * 0.45);
      g.fillRect(x, this.groundY - 200 + i * 10, 2, 10);
    }
  }

  private buildPlayer() {
    const spawnX = this.levelDef.playerSpawn.x;
    const spawnY = this.groundY - P_HALF_H;
    const rect = this.add.rectangle(
      spawnX,
      spawnY,
      P_BODY_W,
      P_BODY_H,
      0x000000,
      0
    );
    this.physics.add.existing(rect);
    this.player = rect as ArcadeRect;
    this.player.body.setCollideWorldBounds(true);
    this.player.body.setMaxVelocity(RUN_SPEED * 1.5, 2000);
    this.playerFx = this.add.graphics();
  }

  private buildEnemies() {
    this.enemyStates = this.levelDef.enemies.map(spawnEnemy);
    for (let i = 0; i < this.enemyStates.length; i++) {
      this.coneFx.push(this.add.graphics());
      this.enemyFx.push(this.add.graphics());
    }
  }

  private buildOverlays() {
    // Hit sparks are drawn in world space (below player) so they sit
    // among the entities rather than over the HUD.
    this.hitSparksFx = this.add.graphics().setDepth(50);

    // Cannon flash overlay — screen-space, transparent until a cannon
    // fires, when it flashes orange briefly.
    this.flashOverlay = this.add
      .rectangle(
        0,
        0,
        this.scale.width,
        this.scale.height,
        0xff8030,
        0
      )
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(95);

    this.promptFx = this.add.graphics();
    this.promptText = this.add
      .text(0, 0, "E", {
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        fontSize: "13px",
        fontStyle: "bold",
        color: "#eab308",
      })
      .setOrigin(0.5, 0.5)
      .setVisible(false);

    this.detectionFx = this.add.graphics().setScrollFactor(0).setDepth(100);
    this.detectionText = this.add
      .text(this.scale.width / 2, 56, "DETECTED", {
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        fontSize: "11px",
        fontStyle: "bold",
        color: "#ff5050",
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(101)
      .setVisible(false);

    // Player HP (top-right)
    this.hpText = this.add
      .text(this.scale.width - 16, 16, this.renderHpString(MAX_PLAYER_HP), {
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        fontSize: "13px",
        color: "#eab308",
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(102);

    this.buildNarrationOverlay();
    this.buildOutroOverlay();
    this.buildCompleteOverlay();
  }

  private renderHpString(hp: number) {
    const filled = "●".repeat(Math.max(0, hp));
    const empty = "○".repeat(Math.max(0, MAX_PLAYER_HP - hp));
    return filled + empty;
  }

  private buildNarrationOverlay() {
    this.narrationContainer = this.buildNarrativeOverlay(
      this.levelDef.openingNarration ?? [],
      true // include chapter title card
    );
  }

  private buildOutroOverlay() {
    this.outroContainer = this.buildNarrativeOverlay(
      this.levelDef.closingNarration ?? [],
      false // no title card on outro — just the closing prose
    );
  }

  /**
   * Build a narrative text overlay. `withTitle` adds a chapter
   * (e.g. "CHAPTER I") and title ("Siege of Malacca") at the top.
   */
  private buildNarrativeOverlay(lines: string[], withTitle: boolean) {
    const w = this.scale.width;
    const h = this.scale.height;

    const bg = this.add
      .rectangle(0, 0, w, h, 0x000000, 0.78)
      .setOrigin(0, 0);

    const elements: Phaser.GameObjects.GameObject[] = [bg];

    const lineGap = 26;
    const titleBlockHeight = withTitle ? 90 : 0;
    const paragraphsHeight = lines.length * lineGap;
    const totalHeight = titleBlockHeight + paragraphsHeight;
    let y = h / 2 - totalHeight / 2;

    if (withTitle) {
      const chapterLabel = this.add
        .text(w / 2, y, this.levelDef.chapter.toUpperCase(), {
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          fontSize: "11px",
          fontStyle: "bold",
          color: "#eab308",
        })
        .setOrigin(0.5)
        .setLetterSpacing(8);
      y += 18;
      const titleText = this.add
        .text(w / 2, y, this.levelDef.title, {
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          fontSize: "26px",
          color: "#ffffff",
        })
        .setOrigin(0.5);
      y += 28;
      // A thin yellow divider under the title
      const divider = this.add
        .rectangle(w / 2, y, 80, 1, 0xeab308, 0.7)
        .setOrigin(0.5);
      y += 22;
      elements.push(chapterLabel, titleText, divider);
    }

    for (let i = 0; i < lines.length; i++) {
      const t = this.add
        .text(w / 2, y + i * lineGap, lines[i], {
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          fontSize: "14px",
          color: "#ffffff",
          align: "center",
          wordWrap: { width: Math.min(620, w - 40) },
        })
        .setOrigin(0.5, 0.5)
        .setAlpha(0.92);
      elements.push(t);
    }

    return this.add
      .container(0, 0, elements)
      .setScrollFactor(0)
      .setDepth(150)
      .setVisible(false);
  }

  private showNarration() {
    if (!this.narrationContainer) return;
    this.narrationContainer.setVisible(true).setAlpha(0);
    this.tweens.add({
      targets: this.narrationContainer,
      alpha: 1,
      duration: 400,
      ease: "Quad.out",
    });
    this.time.delayedCall(NARRATION_MS, () => this.dismissNarration());
    this.input.keyboard?.once("keydown", () => this.dismissNarration());
  }

  private dismissNarration() {
    if (!this.narrationContainer || !this.narrationContainer.visible) return;
    this.tweens.add({
      targets: this.narrationContainer,
      alpha: 0,
      duration: 400,
      ease: "Quad.in",
      onComplete: () => this.narrationContainer.setVisible(false),
    });
  }

  private showOutro() {
    if (!this.outroContainer) return;
    this.outroContainer.setVisible(true).setAlpha(0);
    this.tweens.add({
      targets: this.outroContainer,
      alpha: 1,
      duration: 700,
      ease: "Quad.out",
    });
    this.time.delayedCall(OUTRO_MS, () => this.advanceOutroToComplete());
    this.input.keyboard?.once("keydown", () => this.advanceOutroToComplete());
  }

  private advanceOutroToComplete() {
    if (this.phase !== "outro") return;
    this.tweens.add({
      targets: this.outroContainer,
      alpha: 0,
      duration: 500,
      ease: "Quad.in",
      onComplete: () => {
        this.outroContainer.setVisible(false);
        this.startComplete();
      },
    });
  }

  private buildCompleteOverlay() {
    const w = this.scale.width;
    const h = this.scale.height;
    const dim = this.add
      .rectangle(0, 0, w, h, 0x000000, 0.72)
      .setOrigin(0, 0);
    const title = this.add
      .text(w / 2, h / 2 - 24, "LEVEL COMPLETE", {
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        fontSize: "13px",
        fontStyle: "bold",
        color: "#eab308",
      })
      .setOrigin(0.5);
    const sub = this.add
      .text(w / 2, h / 2 + 4, this.levelDef.title, {
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        fontSize: "16px",
        color: "#ffffff",
      })
      .setOrigin(0.5)
      .setAlpha(0.85);
    const hint = this.add
      .text(w / 2, h / 2 + 42, "PRESS R TO PLAY AGAIN", {
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        fontSize: "10px",
        color: "#ffffff",
      })
      .setOrigin(0.5)
      .setAlpha(0.7);

    this.completeContainer = this.add
      .container(0, 0, [dim, title, sub, hint])
      .setScrollFactor(0)
      .setDepth(200)
      .setVisible(false);
  }

  private bindInput() {
    const kb = this.input.keyboard;
    if (!kb) return;
    this.keys = {
      a: kb.addKey("A"),
      d: kb.addKey("D"),
      w: kb.addKey("W"),
      s: kb.addKey("S"),
      shift: kb.addKey("SHIFT"),
      space: kb.addKey("SPACE"),
    };
    kb.on("keydown-E", () => this.handleActionKey());
    kb.on("keydown-R", () => this.requestRestart());
    kb.addCapture("W,A,S,D,E,R,SPACE,SHIFT");
  }

  private bindCamera() {
    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.levelDef.worldWidth, this.scale.height);
    cam.startFollow(this.player, true, CAMERA_LERP, CAMERA_LERP);
  }

  private handleResize(gameSize: Phaser.Structs.Size) {
    const w = gameSize.width;
    const h = gameSize.height;
    this.physics.world.setBounds(0, 0, this.levelDef.worldWidth, h);
    this.cameras.main.setBounds(0, 0, this.levelDef.worldWidth, h);
    this.detectionText.setPosition(w / 2, 56);
    this.hpText.setPosition(w - 16, 16);
    this.flashOverlay.setSize(w, h);
  }

  // ===== Loop =====

  update() {
    // Slow-mo cleanup — restore real-time when the kill window expires.
    if (this.slowMoEndAt > 0 && performance.now() >= this.slowMoEndAt) {
      this.physics.world.timeScale = 1;
      this.tweens.timeScale = 1;
      this.slowMoEndAt = 0;
    }

    if (this.phase === "playing") this.updatePlaying();
    // Sparks fade even outside playing (so kill sparks finish during slow-mo)
    if (this.phase !== "playing") {
      this.updateHitSparks(this.game.loop.delta);
    }
    this.redrawAll();
  }

  private updatePlaying() {
    const sprinting = this.keys.shift.isDown;
    const speed = sprinting ? RUN_SPEED : WALK_SPEED;
    const grounded = this.player.body.blocked.down;
    const dtMs = this.game.loop.delta;

    this.playerCrouching = this.keys.s.isDown && grounded;

    if (this.playerCrouching) {
      this.player.body.setVelocityX(0);
    } else if (this.keys.a.isDown && !this.keys.d.isDown) {
      this.player.body.setVelocityX(-speed);
      this.playerFacing = -1;
    } else if (this.keys.d.isDown && !this.keys.a.isDown) {
      this.player.body.setVelocityX(speed);
      this.playerFacing = 1;
    } else {
      this.player.body.setVelocityX(0);
    }

    if (
      (this.keys.space.isDown || this.keys.w.isDown) &&
      grounded &&
      !this.playerCrouching
    ) {
      this.player.body.setVelocityY(JUMP_VEL_Y);
      this.audio?.playJump();
    }

    // Landing — wasGrounded false → grounded true
    if (grounded && !this.wasGrounded) {
      this.audio?.playLand();
    }
    this.wasGrounded = grounded;

    // Cannons (only during active gameplay)
    this.cannonTimerMs += dtMs;
    if (this.cannonTimerMs >= this.nextCannonAtMs) {
      this.fireCannon();
      this.scheduleNextCannon();
    }

    // Hit-spark particles
    this.updateHitSparks(dtMs);

    // Enemy AI
    for (let i = 0; i < this.enemyStates.length; i++) {
      tickEnemy(this.enemyStates[i], this.levelDef.enemies[i]);
    }

    // Detection (stealth enemies only — combat enemies skip)
    const playerFootY = this.player.y + P_HALF_H;
    const sight = { x: this.player.x, y: playerFootY };
    let anySpotted = false;
    for (let i = 0; i < this.enemyStates.length; i++) {
      if (
        isInVisionCone(
          this.enemyStates[i],
          this.levelDef.enemies[i],
          sight,
          this.groundY
        )
      ) {
        anySpotted = true;
        break;
      }
    }
    this.detectionFrames = anySpotted
      ? Math.min(this.detectionFrames + 1, 999)
      : Math.max(this.detectionFrames - 2, 0);

    // Combat: knight strikes hitting the player?
    for (let i = 0; i < this.enemyStates.length; i++) {
      const s = this.enemyStates[i];
      const d = this.levelDef.enemies[i];
      if (s.kind === "templar-knight" && d.kind === "templar-knight") {
        if (knightStrikeHits({ x: this.player.x }, s, d)) {
          this.applyPlayerDamage(d.damage);
        }
      }
    }

    // Animation clock
    const vx = this.player.body.velocity.x;
    if (vx !== 0 && grounded) {
      this.playerAnimTime += sprinting ? 0.28 : 0.18;
      // Footstep on leg-swing zero crossing
      const sin = Math.sin(this.playerAnimTime);
      const sign = sin > 0 ? 1 : sin < 0 ? -1 : 0;
      if (sign !== 0 && sign !== this.prevLegSinSign) {
        this.audio?.playFootstep();
      }
      this.prevLegSinSign = sign;
    } else {
      this.playerAnimTime = 0;
      this.prevLegSinSign = 0;
    }

    // Phase transitions
    if (this.detectionFrames >= RESPAWN_THRESHOLD) {
      this.startRespawn();
    } else if (this.playerHp <= 0) {
      this.startRespawn();
    } else if (this.player.x >= this.levelDef.endTriggerX) {
      this.startOutro();
    }
  }

  private applyPlayerDamage(amount: number) {
    if (amount <= 0) return;
    this.playerHp = Math.max(0, this.playerHp - amount);
    this.hpText.setText(this.renderHpString(this.playerHp));
    this.playerHitFlashUntil = performance.now() + 220;
    this.cameras.main.shake(150, 0.006);
    this.audio?.playHurt();
    this.spawnHitSparks(this.player.x, this.player.y, 6, 0xff5050);
  }

  /**
   * Single action key (E) — context-sensitive.
   * Priority: stealth kill > parry > strike.
   */
  private handleActionKey() {
    if (this.phase !== "playing") return;
    if (this.narrationContainer.visible) {
      this.dismissNarration();
      return;
    }

    const footY = this.player.y + P_HALF_H;
    const actor = { x: this.player.x };

    // 1. Stealth kill on a patrol guard?
    const stealthTarget = findStealthKillTarget(
      { x: this.player.x, y: footY },
      this.enemyStates,
      this.groundY
    );
    if (stealthTarget) {
      const enemy = this.enemyStates[stealthTarget.enemyIdx];
      killEnemy(enemy);
      if (stealthTarget.kind === "air") {
        this.player.setPosition(enemy.x, this.groundY - enemy.dy - P_HALF_H);
        this.player.body.setVelocity(0, 0);
      }
      this.triggerAttackAnimation();
      this.audio?.playStealthKill();
      this.triggerKillEffect(enemy.x, this.groundY - enemy.dy - 28);
      return;
    }

    // 2. Parry / strike against a templar-knight?
    for (let i = 0; i < this.enemyStates.length; i++) {
      const s = this.enemyStates[i];
      const d = this.levelDef.enemies[i];
      if (s.kind !== "templar-knight" || d.kind !== "templar-knight") continue;
      if (s.dead) continue;

      // Parry beats strike if a telegraph is active and we're in range
      if (tryParry(actor, s, d)) {
        this.triggerAttackAnimation();
        this.audio?.playParry();
        this.cameras.main.shake(120, 0.005);
        this.spawnHitSparks(s.x, this.groundY - s.dy - 30, 6, 0xffd84a);
        return;
      }
      if (applyPlayerStrike(actor, s, d, 1)) {
        this.triggerAttackAnimation();
        if (s.dead) {
          this.audio?.playKill();
          this.triggerKillEffect(s.x, this.groundY - s.dy - 30);
        } else {
          this.audio?.playStrike();
          this.spawnHitSparks(s.x, this.groundY - s.dy - 30, 6, 0xeab308);
          this.cameras.main.shake(80, 0.003);
        }
        return;
      }
    }
  }

  private triggerKillEffect(x: number, y: number) {
    this.spawnHitSparks(x, y, 16, 0xeab308);
    this.cameras.main.shake(220, 0.01);
    // Slow-mo: both physics + tweens use timeScale where <1 = slower.
    this.physics.world.timeScale = KILL_SLOWMO_SCALE;
    this.tweens.timeScale = KILL_SLOWMO_SCALE;
    this.slowMoEndAt = performance.now() + KILL_SLOWMO_MS;
  }

  private triggerAttackAnimation() {
    this.playerAttackUntil = performance.now() + 220;
  }

  private requestRestart() {
    if (this.phase === "playing" || this.phase === "complete") {
      this.startRespawn();
    }
  }

  private startRespawn() {
    if (this.phase === "respawning") return;
    this.phase = "respawning";
    this.completeContainer.setVisible(false);
    this.cameras.main.fadeOut(FADE_MS, 0, 0, 0);
    this.cameras.main.once(
      Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE,
      () => {
        this.resetLevel();
        this.cameras.main.fadeIn(FADE_MS, 0, 0, 0);
        this.cameras.main.once(
          Phaser.Cameras.Scene2D.Events.FADE_IN_COMPLETE,
          () => {
            this.phase = "playing";
          }
        );
      }
    );
  }

  private startOutro() {
    if (this.phase === "outro" || this.phase === "complete") return;
    const hasOutro = (this.levelDef.closingNarration ?? []).length > 0;
    if (!hasOutro) {
      // No closing narration — go straight to complete.
      this.startComplete();
      return;
    }
    this.phase = "outro";
    this.player.body.setVelocity(0, 0);
    this.showOutro();
  }

  private startComplete() {
    if (this.phase === "complete") return;
    this.phase = "complete";
    this.player.body.setVelocity(0, 0);
    this.completeContainer.setVisible(true).setAlpha(0);
    this.tweens.add({
      targets: this.completeContainer,
      alpha: 1,
      duration: 500,
      ease: "Quad.out",
    });
  }

  private fireCannon() {
    this.audio?.playCannon();
    // Camera shake — keep it modest so it doesn't ruin combat reading
    this.cameras.main.shake(280, 0.0035);
    // Brief orange flash overlay
    this.flashOverlay.setAlpha(0.35);
    this.tweens.add({
      targets: this.flashOverlay,
      alpha: 0,
      duration: 320,
      ease: "Quad.in",
    });
  }

  private spawnHitSparks(
    x: number,
    y: number,
    count: number,
    color: number = 0xeab308
  ) {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      const speed = 90 + Math.random() * 140;
      this.hitSparks.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 60,
        life: 320,
        maxLife: 320,
      });
    }
    // Store color on the most-recent batch via the alpha trick — we
    // actually pass color into the draw, so stash it on each particle.
    // (Simpler: store color per particle. Refactoring inline:)
    const start = this.hitSparks.length - count;
    for (let i = start; i < this.hitSparks.length; i++) {
      (this.hitSparks[i] as unknown as { color: number }).color = color;
    }
  }

  private updateHitSparks(dtMs: number) {
    const dt = dtMs / 1000;
    for (let i = this.hitSparks.length - 1; i >= 0; i--) {
      const s = this.hitSparks[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy += 720 * dt; // gravity
      s.vx *= 0.96; // drag
      s.life -= dtMs;
      if (s.life <= 0) this.hitSparks.splice(i, 1);
    }
  }

  private drawHitSparks() {
    const g = this.hitSparksFx;
    g.clear();
    for (const s of this.hitSparks) {
      const alpha = Math.max(0, s.life / s.maxLife);
      const color = (s as unknown as { color: number }).color ?? 0xeab308;
      g.fillStyle(color, alpha);
      g.fillRect(s.x - 1.5, s.y - 1.5, 3, 3);
    }
  }

  private resetLevel() {
    this.player.setPosition(
      this.levelDef.playerSpawn.x,
      this.groundY - P_HALF_H
    );
    this.player.body.setVelocity(0, 0);
    this.playerFacing = 1;
    this.playerCrouching = false;
    this.playerAnimTime = 0;
    this.playerHp = MAX_PLAYER_HP;
    this.hpText.setText(this.renderHpString(this.playerHp));
    this.prevLegSinSign = 0;
    this.wasGrounded = false;

    for (let i = 0; i < this.enemyStates.length; i++) {
      Object.assign(this.enemyStates[i], spawnEnemy(this.levelDef.enemies[i]));
    }
    this.detectionFrames = 0;
    this.hitSparks.length = 0;
    this.completeContainer.setVisible(false);
    this.outroContainer.setVisible(false);
    this.dismissNarration();

    // Restore time scale in case respawn fires mid slow-mo
    this.physics.world.timeScale = 1;
    this.tweens.timeScale = 1;
    this.slowMoEndAt = 0;

    this.scheduleNextCannon();
  }

  // ===== Drawing =====

  private redrawAll() {
    this.redrawPlayer();
    for (let i = 0; i < this.enemyStates.length; i++) {
      this.redrawCone(i);
      this.redrawEnemy(i);
    }
    this.drawHitSparks();
    this.redrawStealthPrompt();
    this.redrawDetectionOverlay();
  }

  private redrawPlayer() {
    const g = this.playerFx;
    g.clear();
    const now = performance.now();
    const cx = this.player.x;
    const footY = this.player.y + P_HALF_H;
    const onGround = this.player.body.blocked.down;
    const vx = this.player.body.velocity.x;

    const bob =
      onGround && vx !== 0 ? Math.abs(Math.sin(this.playerAnimTime)) * 1.5 : 0;
    const legSwing =
      onGround && vx !== 0 ? Math.sin(this.playerAnimTime) * 5 : 0;
    // Arms swing opposite-phase from legs (natural walking)
    const armSwing = onGround && vx !== 0 ? Math.sin(this.playerAnimTime) * 4 : 0;

    // Hit recoil — kick back along the world x axis (opposite of facing).
    const hit = now < this.playerHitFlashUntil;
    const hitProgress = hit ? 1 - (this.playerHitFlashUntil - now) / 220 : 0;
    const hitOffset = hit
      ? -Math.sin(hitProgress * Math.PI) * 5 * this.playerFacing
      : 0;

    // Attack thrust — front arm extends forward over ~220ms.
    const attacking = now < this.playerAttackUntil;
    const attackProgress = attacking
      ? 1 - (this.playerAttackUntil - now) / 220
      : 0;
    const armExtend = attacking ? Math.sin(attackProgress * Math.PI) * 12 : 0;

    // Palette — white silhouette so it pops on any backdrop.
    const SKIN = hit ? 0xff5050 : 0xf2f2f2;
    const HOOD = hit ? 0xff7070 : 0xc8c8c8;
    const SASH = 0x7a1a1a;
    const SKIN_ALPHA = hit ? 0.9 : 1;

    g.save();
    g.translateCanvas(cx + hitOffset, footY - bob);
    g.scaleCanvas(this.playerFacing, 1);
    if (this.playerCrouching) {
      g.translateCanvas(0, 14);
      g.scaleCanvas(1, 0.55);
    }

    // Back arm (drawn first so the body covers part of it)
    g.fillStyle(SKIN, SKIN_ALPHA);
    g.fillRect(-11 - armSwing * 0.3, -28, 4, 12);

    // Legs
    g.fillRect(-7 + legSwing * 0.4, -14, 5, 14);
    g.fillRect(2 - legSwing * 0.4, -14, 5, 14);

    // Body
    g.fillRect(-9, -32, 18, 18);

    // Sash (red — the AC accent stays red regardless of hit state)
    g.fillStyle(SASH, 1);
    g.fillRect(-9, -22, 18, 3);

    // Head
    g.fillStyle(SKIN, SKIN_ALPHA);
    g.fillCircle(0, -38, 8);

    // Hood drape
    g.fillStyle(HOOD, 1);
    g.beginPath();
    g.moveTo(-12, -42);
    g.lineTo(-7, -30);
    g.lineTo(7, -30);
    g.lineTo(12, -42);
    g.closePath();
    g.fillPath();

    // Face shadow under the hood (the iconic AC look)
    g.fillStyle(0x000000, 0.6);
    g.fillCircle(0, -36, 5.5);

    // Front arm — either thrusting forward or swinging in place
    g.fillStyle(SKIN, SKIN_ALPHA);
    if (attacking) {
      // Arm extends forward as a horizontal rect from the shoulder
      g.fillRect(7, -26, 13 + armExtend, 4);
      // Small "blade" suggestion at the tip
      if (armExtend > 2) {
        g.fillRect(18 + armExtend, -28, 4, 8);
      }
    } else {
      g.fillRect(7 + armSwing * 0.3, -28, 4, 12);
    }

    g.restore();
  }

  private redrawCone(i: number) {
    const g = this.coneFx[i];
    g.clear();
    const state = this.enemyStates[i];
    const def = this.levelDef.enemies[i];
    if (state.dead) return;
    if (state.kind !== "templar-guard" || def.kind !== "templar-guard") return;

    const alerted = this.detectionFrames > 0;
    const eyeX = state.x;
    const eyeY = this.groundY - state.dy - GUARD_EYE_DY;

    g.save();
    g.translateCanvas(eyeX, eyeY);
    g.scaleCanvas(state.facing, 1);

    const fillColor = alerted ? 0xdc2626 : 0xeab308;
    const fillAlpha = alerted ? 0.22 : 0.13;
    const lineAlpha = alerted ? 0.55 : 0.35;

    g.fillStyle(fillColor, fillAlpha);
    g.lineStyle(1, fillColor, lineAlpha);
    g.beginPath();
    g.moveTo(0, 0);
    g.arc(
      0,
      0,
      def.visionLength,
      def.visionCenterAngle - def.visionHalfAngle,
      def.visionCenterAngle + def.visionHalfAngle,
      false
    );
    g.closePath();
    g.fillPath();
    g.strokePath();
    g.restore();
  }

  private redrawEnemy(i: number) {
    const g = this.enemyFx[i];
    g.clear();
    const state = this.enemyStates[i];
    if (state.kind === "templar-guard") {
      if (state.dead) this.drawTemplarGuardDead(g, state);
      else this.drawTemplarGuardAlive(g, state);
    } else if (state.kind === "templar-knight") {
      const def = this.levelDef.enemies[i];
      if (def.kind !== "templar-knight") return;
      if (state.dead) this.drawTemplarKnightDead(g, state);
      else this.drawTemplarKnightAlive(g, state, def);
    }
  }

  private drawTemplarGuardAlive(
    g: Phaser.GameObjects.Graphics,
    s: TemplarGuardState
  ) {
    const bob = s.pauseFrames === 0 ? Math.abs(Math.sin(s.animTime)) * 1.2 : 0;
    const legSwing = s.pauseFrames === 0 ? Math.sin(s.animTime) * 4 : 0;

    g.save();
    g.translateCanvas(s.x, this.groundY - s.dy - bob);
    g.scaleCanvas(s.facing, 1);

    g.fillStyle(0x3a1414, 1);
    g.fillRect(-7 + legSwing * 0.4, -14, 5, 14);
    g.fillRect(2 - legSwing * 0.4, -14, 5, 14);
    g.fillStyle(0x5c1c1c, 1);
    g.fillRect(-10, -34, 20, 20);
    g.fillStyle(0xd4a73c, 1);
    g.fillRect(-1, -32, 2, 16);
    g.fillRect(-7, -25, 14, 2);
    g.fillStyle(0x1f1110, 1);
    g.fillCircle(0, -40, 7);
    g.fillStyle(0x7a5c20, 1);
    g.beginPath();
    g.moveTo(-9, -42);
    g.lineTo(-7, -34);
    g.lineTo(7, -34);
    g.lineTo(9, -42);
    g.closePath();
    g.fillPath();

    g.restore();
  }

  private drawTemplarGuardDead(
    g: Phaser.GameObjects.Graphics,
    s: TemplarGuardState
  ) {
    const settle = Math.min(1, s.deathTimer / 15);
    g.save();
    g.translateCanvas(s.x, this.groundY - s.dy);
    g.scaleCanvas(s.facing, 1);
    const bodyW = 26;
    const bodyH = 6 + (1 - settle) * 6;
    g.fillStyle(0x3a1010, 1);
    g.fillRect(-bodyW / 2, -bodyH, bodyW, bodyH);
    g.fillStyle(0x7a5c20, 1);
    g.fillRect(-bodyW / 2 + 4, -bodyH + 1, 6, 2);
    g.fillStyle(0x1f1110, 1);
    g.fillCircle(bodyW / 2 - 2, -bodyH + 2, 5);
    g.fillStyle(0x000000, 0.35);
    g.fillEllipse(0, 2, bodyW + 8, 6);
    g.restore();
  }

  private drawTemplarKnightAlive(
    g: Phaser.GameObjects.Graphics,
    s: TemplarKnightState,
    d: TemplarKnightDef
  ) {
    // Telegraph: arm raised (sword high).
    // Striking:  arm down (sword forward).
    // Stunned/recovery/idle: idle pose.
    const isTelegraph = s.combatPhase === "telegraph";
    const isStriking = s.combatPhase === "striking";
    const isStunned = s.combatPhase === "stunned";

    // Optional pulsing tint to signal telegraph
    const telegraphPulse = isTelegraph
      ? 0.5 + 0.5 * Math.sin(performance.now() / 80)
      : 0;

    g.save();
    g.translateCanvas(s.x, this.groundY - s.dy);
    g.scaleCanvas(s.facing, 1);

    // Stunned = slumped slightly forward
    if (isStunned) g.rotateCanvas(0.18);

    // Legs (slightly wider stance than guard)
    g.fillStyle(0x2e1010, 1);
    g.fillRect(-8, -16, 6, 16);
    g.fillRect(2, -16, 6, 16);

    // Body — heavier than guard
    g.fillStyle(0x6b1f1f, 1);
    g.fillRect(-12, -38, 24, 22);

    // Templar cross (more prominent)
    g.fillStyle(0xd4a73c, 1);
    g.fillRect(-2, -36, 4, 18);
    g.fillRect(-9, -27, 18, 4);

    // Helmet (visored)
    g.fillStyle(0x9a7820, 1);
    g.fillRect(-9, -50, 18, 14);
    g.fillStyle(0x000000, 0.6);
    g.fillRect(-8, -44, 16, 3); // visor slit

    // Sword
    g.lineStyle(2, 0xc0c0c0, 1);
    if (isTelegraph) {
      // Raised high — wind-up. Pulsing yellow telegraph aura.
      g.fillStyle(0xeab308, 0.4 + telegraphPulse * 0.3);
      g.fillCircle(8, -56, 8);
      g.beginPath();
      g.moveTo(8, -30);
      g.lineTo(18, -60);
      g.strokePath();
      g.fillStyle(0xb0a070, 1);
      g.fillRect(7, -30, 4, 4); // hilt
    } else if (isStriking) {
      // Forward — live strike
      g.beginPath();
      g.moveTo(8, -28);
      g.lineTo(38, -22);
      g.strokePath();
      g.fillStyle(0xb0a070, 1);
      g.fillRect(7, -30, 4, 4);
    } else {
      // Resting
      g.beginPath();
      g.moveTo(8, -22);
      g.lineTo(18, -6);
      g.strokePath();
      g.fillStyle(0xb0a070, 1);
      g.fillRect(7, -24, 4, 4);
    }

    // HP pips above head
    g.fillStyle(0xeab308, 0.95);
    for (let h = 0; h < d.hp; h++) {
      const filled = h < s.hp;
      if (filled) {
        g.fillStyle(0xeab308, 0.95);
        g.fillRect(-8 + h * 7, -64, 5, 4);
      } else {
        g.lineStyle(1, 0xeab308, 0.55);
        g.strokeRect(-8 + h * 7, -64, 5, 4);
      }
    }

    g.restore();
  }

  private drawTemplarKnightDead(
    g: Phaser.GameObjects.Graphics,
    s: TemplarKnightState
  ) {
    const settle = Math.min(1, s.deathTimer / 18);
    g.save();
    g.translateCanvas(s.x, this.groundY - s.dy);
    g.scaleCanvas(s.facing, 1);
    const bodyW = 34;
    const bodyH = 8 + (1 - settle) * 10;
    g.fillStyle(0x4a1010, 1);
    g.fillRect(-bodyW / 2, -bodyH, bodyW, bodyH);
    g.fillStyle(0xd4a73c, 0.85);
    g.fillRect(-2, -bodyH + 2, 4, 4);
    g.fillStyle(0x9a7820, 1);
    g.fillCircle(bodyW / 2 - 3, -bodyH + 3, 6);
    g.fillStyle(0x000000, 0.4);
    g.fillEllipse(0, 2, bodyW + 10, 7);
    g.restore();
  }

  private redrawStealthPrompt() {
    const g = this.promptFx;
    g.clear();
    if (this.phase !== "playing") {
      this.promptText.setVisible(false);
      return;
    }
    const footY = this.player.y + P_HALF_H;
    const target = findStealthKillTarget(
      { x: this.player.x, y: footY },
      this.enemyStates,
      this.groundY
    );
    if (!target) {
      this.promptText.setVisible(false);
      return;
    }
    const enemy = this.enemyStates[target.enemyIdx];
    const px = enemy.x;
    const py = this.groundY - enemy.dy - 62;
    const pulse = 0.85 + 0.15 * Math.sin(performance.now() / 220);

    g.setAlpha(pulse);
    if (target.kind === "air") {
      g.fillStyle(0xeab308, 0.95);
      g.beginPath();
      g.moveTo(px, py - 18);
      g.lineTo(px - 5, py - 25);
      g.lineTo(px + 5, py - 25);
      g.closePath();
      g.fillPath();
    }
    g.fillStyle(0x000000, 0.78);
    g.fillCircle(px, py, 11);
    g.lineStyle(1.5, 0xeab308, 0.95);
    g.strokeCircle(px, py, 11);
    this.promptText
      .setPosition(px, py + 1)
      .setAlpha(pulse)
      .setVisible(true);
  }

  private redrawDetectionOverlay() {
    const g = this.detectionFx;
    g.clear();
    if (this.detectionFrames <= 0) {
      this.detectionText.setVisible(false);
      return;
    }
    const w = this.scale.width;
    const h = this.scale.height;
    const intensity = Math.min(1, this.detectionFrames / 20);
    g.fillStyle(0xdc2626, 0.18 * intensity);
    g.fillRect(0, 0, w, h);
    this.detectionText
      .setAlpha(Math.min(1, intensity * 1.2))
      .setVisible(this.detectionFrames > 6);
  }
}
