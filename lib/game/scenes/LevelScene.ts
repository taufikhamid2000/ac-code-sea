import Phaser from "phaser";
import type { EnemyDef, LevelDef } from "@/lib/levels";
import {
  type EnemyState,
  findStealthKillTarget,
  isInVisionCone,
  killEnemy,
  spawnEnemy,
  tickEnemy,
} from "@/lib/engine/enemy";

/**
 * The level scene. One scene runs a single LevelDef end-to-end.
 *
 * Reusable parts that stayed agnostic to the renderer:
 *   - lib/levels/*        : data
 *   - lib/engine/enemy.ts : pure state + math (patrol, vision, kill rules)
 *
 * This file is the Phaser-specific glue: it drives those primitives,
 * owns the physics bodies, and draws the visuals via Graphics overlays.
 *
 * Drawing strategy: each entity has an invisible Rectangle as its
 * physics body and a Graphics overlay redrawn every frame at the body's
 * position. When we have real art, the Graphics calls swap to Sprite +
 * animations. This kept the visual identity from the canvas version.
 */

// ===== Engine constants — same feel as the hand-rolled version =====
const GRAVITY_Y = 2520; // px/s²
const JUMP_VEL_Y = -780; // px/s
const WALK_SPEED = 180; // px/s
const RUN_SPEED = 330; // px/s
const GROUND_RATIO = 0.85;
const CAMERA_LERP = 0.12;

// Player bounding box
const P_BODY_W = 18;
const P_BODY_H = 50;
const P_HALF_H = P_BODY_H / 2;

// Templar guard — eye height must match EYE_DY_BY_KIND in lib/engine
const GUARD_EYE_DY = 36;

// Game loop
const RESPAWN_THRESHOLD = 50; // frames
const FADE_MS = 500;

type Phase = "playing" | "respawning" | "complete";

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

  // Enemies
  private enemyStates: EnemyState[] = [];
  private enemyFx: Phaser.GameObjects.Graphics[] = [];
  private coneFx: Phaser.GameObjects.Graphics[] = [];

  // UI
  private promptFx!: Phaser.GameObjects.Graphics;
  private promptText!: Phaser.GameObjects.Text;
  private detectionFx!: Phaser.GameObjects.Graphics;
  private detectionText!: Phaser.GameObjects.Text;
  private completeContainer!: Phaser.GameObjects.Container;

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

    // Re-layout overlays when the viewport resizes.
    this.scale.on("resize", this.handleResize, this);
  }

  // ===== Build helpers =====

  private buildGround() {
    const w = this.levelDef.worldWidth;

    // Visible ground line
    this.add.rectangle(w / 2, this.groundY, w, 1, 0xeab308, 0.35);

    // Tick marks every 100px
    const ticks = this.add.graphics();
    ticks.fillStyle(0xeab308, 0.12);
    for (let x = 0; x <= w; x += 100) {
      ticks.fillRect(x, this.groundY + 2, 1, 4);
    }

    // Invisible static body acting as the floor (extends below screen
    // so the player can't fall through during big drops)
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

      // Yellow top edge accent
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
    // Approximate the gradient with stacked alpha rectangles
    for (let i = 0; i < 20; i++) {
      g.fillStyle(0xeab308, 0.025 + (i / 20) * 0.45);
      const y = this.groundY - 200 + i * 10;
      g.fillRect(x, y, 2, 10);
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
    // Stealth-kill prompt (world space)
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

    // Detection vignette + DETECTED chip (screen space)
    this.detectionFx = this.add
      .graphics()
      .setScrollFactor(0)
      .setDepth(100);
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

    // Complete overlay
    this.buildCompleteOverlay();
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
    kb.on("keydown-E", () => this.tryStealthKill());
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
    // Recompute ground; rebuild would be cleaner, but for the prototype
    // we just rescale the bounds and accept that mid-game resize is rough.
    this.physics.world.setBounds(0, 0, this.levelDef.worldWidth, h);
    this.cameras.main.setBounds(0, 0, this.levelDef.worldWidth, h);
    this.detectionText.setPosition(w / 2, 56);
    this.completeContainer.list.forEach((obj, i) => {
      const child = obj as Phaser.GameObjects.Rectangle | Phaser.GameObjects.Text;
      if (i === 0) {
        (child as Phaser.GameObjects.Rectangle).setSize(w, h);
      } else if ("setPosition" in child) {
        const offsets = [0, -24, 4, 42];
        child.setPosition(w / 2, h / 2 + offsets[i]);
      }
    });
  }

  // ===== Per-frame =====

  update() {
    if (this.phase === "playing") this.updatePlaying();
    this.redrawAll();
  }

  private updatePlaying() {
    const sprinting = this.keys.shift.isDown;
    const speed = sprinting ? RUN_SPEED : WALK_SPEED;
    const grounded = this.player.body.blocked.down;

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
    }

    // Enemy AI
    for (let i = 0; i < this.enemyStates.length; i++) {
      tickEnemy(this.enemyStates[i], this.levelDef.enemies[i]);
    }

    // Detection
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

    // Animation clock
    const vx = this.player.body.velocity.x;
    if (vx !== 0 && grounded) {
      this.playerAnimTime += sprinting ? 0.28 : 0.18;
    } else {
      this.playerAnimTime = 0;
    }

    // Phase transitions
    if (this.detectionFrames >= RESPAWN_THRESHOLD) {
      this.startRespawn();
    } else if (this.player.x >= this.levelDef.endTriggerX) {
      this.startComplete();
    }
  }

  private tryStealthKill() {
    if (this.phase !== "playing") return;
    const footY = this.player.y + P_HALF_H;
    const target = findStealthKillTarget(
      { x: this.player.x, y: footY },
      this.enemyStates,
      this.groundY
    );
    if (!target) return;
    const enemy = this.enemyStates[target.enemyIdx];
    killEnemy(enemy);
    if (target.kind === "air") {
      this.player.setPosition(enemy.x, this.groundY - P_HALF_H);
      this.player.body.setVelocity(0, 0);
    }
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

  private resetLevel() {
    this.player.setPosition(
      this.levelDef.playerSpawn.x,
      this.groundY - P_HALF_H
    );
    this.player.body.setVelocity(0, 0);
    this.playerFacing = 1;
    this.playerCrouching = false;
    this.playerAnimTime = 0;

    for (let i = 0; i < this.enemyStates.length; i++) {
      Object.assign(this.enemyStates[i], spawnEnemy(this.levelDef.enemies[i]));
    }
    this.detectionFrames = 0;
    this.completeContainer.setVisible(false);
  }

  // ===== Drawing =====

  private redrawAll() {
    this.redrawPlayer();
    for (let i = 0; i < this.enemyStates.length; i++) {
      this.redrawCone(i);
      this.redrawEnemy(i);
    }
    this.redrawStealthPrompt();
    this.redrawDetectionOverlay();
  }

  private redrawPlayer() {
    const g = this.playerFx;
    g.clear();
    const cx = this.player.x;
    const footY = this.player.y + P_HALF_H;
    const onGround = this.player.body.blocked.down;
    const vx = this.player.body.velocity.x;
    const bob =
      onGround && vx !== 0 ? Math.abs(Math.sin(this.playerAnimTime)) * 1.5 : 0;
    const legSwing =
      onGround && vx !== 0 ? Math.sin(this.playerAnimTime) * 5 : 0;

    g.save();
    g.translateCanvas(cx, footY - bob);
    g.scaleCanvas(this.playerFacing, 1);
    if (this.playerCrouching) {
      g.translateCanvas(0, 14);
      g.scaleCanvas(1, 0.55);
    }

    // Legs
    g.fillStyle(0x0a0a0a, 1);
    g.fillRect(-7 + legSwing * 0.4, -14, 5, 14);
    g.fillRect(2 - legSwing * 0.4, -14, 5, 14);
    // Body
    g.fillRect(-9, -32, 18, 18);
    // Sash
    g.fillStyle(0x7a1a1a, 1);
    g.fillRect(-9, -22, 18, 3);
    // Head
    g.fillStyle(0x0a0a0a, 1);
    g.fillCircle(0, -38, 8);
    // Hood drape
    g.fillStyle(0x171717, 1);
    g.beginPath();
    g.moveTo(-12, -42);
    g.lineTo(-7, -30);
    g.lineTo(7, -30);
    g.lineTo(12, -42);
    g.closePath();
    g.fillPath();
    // Face shadow
    g.fillStyle(0x000000, 0.6);
    g.fillCircle(0, -36, 5.5);

    g.restore();
  }

  private redrawCone(i: number) {
    const g = this.coneFx[i];
    g.clear();
    const state = this.enemyStates[i];
    if (state.dead) return;
    const def = this.levelDef.enemies[i];
    const alerted = this.detectionFrames > 0;

    const eyeX = state.x;
    const eyeY = this.groundY - GUARD_EYE_DY;

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
    const def = this.levelDef.enemies[i];
    if (def.kind !== "templar-guard") return;
    if (state.dead) this.drawTemplarDead(g, state);
    else this.drawTemplarAlive(g, state);
  }

  private drawTemplarAlive(g: Phaser.GameObjects.Graphics, state: EnemyState) {
    const bob =
      state.pauseFrames === 0 ? Math.abs(Math.sin(state.animTime)) * 1.2 : 0;
    const legSwing =
      state.pauseFrames === 0 ? Math.sin(state.animTime) * 4 : 0;

    g.save();
    g.translateCanvas(state.x, this.groundY - bob);
    g.scaleCanvas(state.facing, 1);

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

  private drawTemplarDead(g: Phaser.GameObjects.Graphics, state: EnemyState) {
    const settle = Math.min(1, state.deathTimer / 15);

    g.save();
    g.translateCanvas(state.x, this.groundY);
    g.scaleCanvas(state.facing, 1);

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
    const py = this.groundY - 62;
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
