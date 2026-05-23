import { useEffect, useRef } from "react";
import type { EnemyDef, LevelDef, PlatformDef } from "@/lib/levels";
import {
  type EnemyState,
  findStealthKillTarget,
  isInVisionCone,
  killEnemy,
  spawnEnemy,
  tickEnemy,
} from "@/lib/engine/enemy";

// ===== Engine constants — same across all levels =====
const GRAVITY = 0.7;
const JUMP_VEL = -13;
const WALK_SPEED = 3;
const RUN_SPEED = 5.5;
const GROUND_RATIO = 0.85;
const CAMERA_LERP = 0.12;

// Player bounding box (relative to feet point)
const P_HALF_W = 9;
const P_HEIGHT = 50;

// Guard rendering (visual only; cone math lives in lib/engine/enemy.ts)
const GUARD_EYE_DY = 36; // must match EYE_DY_BY_KIND["templar-guard"]

type Platform = { x: number; y: number; w: number; h: number };

type PlayerState = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  onGround: boolean;
  crouching: boolean;
  animTime: number;
};

// All keys the game cares about. Held vs. edge-triggered is decided at
// the read site (heldKeys vs. justPressed).
const TRACKED_KEYS = new Set([
  "w",
  "a",
  "s",
  "d",
  "space",
  "shift",
  "e",
]);

function normalizeKey(e: KeyboardEvent): string {
  const k = e.key.toLowerCase();
  return k === " " ? "space" : k;
}

function aabbHit(px: number, py: number, p: Platform): boolean {
  const pLeft = px - P_HALF_W;
  const pRight = px + P_HALF_W;
  const pTop = py - P_HEIGHT;
  const pBottom = py;
  return (
    pRight > p.x &&
    pLeft < p.x + p.w &&
    pBottom > p.y &&
    pTop < p.y + p.h
  );
}

function materializePlatforms(
  defs: PlatformDef[],
  groundY: number
): Platform[] {
  return defs.map((p) => ({
    x: p.x,
    y: groundY - p.dy,
    w: p.w,
    h: p.h,
  }));
}

type Props = {
  level: LevelDef;
};

export default function Platformer({ level }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;
    const ctxOrNull = canvasEl.getContext("2d");
    if (!ctxOrNull) return;
    const canvas: HTMLCanvasElement = canvasEl;
    const ctx: CanvasRenderingContext2D = ctxOrNull;

    const player: PlayerState = {
      x: level.playerSpawn.x,
      y: 0,
      vx: 0,
      vy: 0,
      facing: 1,
      onGround: false,
      crouching: false,
      animTime: 0,
    };
    const enemies: EnemyState[] = level.enemies.map(spawnEnemy);
    const camera = { x: 0 };
    const heldKeys = new Set<string>();
    const justPressed = new Set<string>();
    let detectionFrames = 0;

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);

    function onDown(e: KeyboardEvent) {
      const k = normalizeKey(e);
      if (TRACKED_KEYS.has(k)) {
        e.preventDefault();
        if (!heldKeys.has(k)) {
          justPressed.add(k);
        }
        heldKeys.add(k);
      }
    }
    function onUp(e: KeyboardEvent) {
      heldKeys.delete(normalizeKey(e));
    }
    function onBlur() {
      heldKeys.clear();
    }
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", onBlur);

    let raf = 0;
    function tick() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const groundY = h * GROUND_RATIO;
      const platforms = materializePlatforms(level.platforms, groundY);

      // ===== Input → player intent =====
      const sprinting = heldKeys.has("shift");
      const speed = sprinting ? RUN_SPEED : WALK_SPEED;
      player.crouching = heldKeys.has("s") && player.onGround;

      const left = heldKeys.has("a");
      const right = heldKeys.has("d");
      if (player.crouching) {
        player.vx = 0;
      } else if (left && !right) {
        player.vx = -speed;
        player.facing = -1;
      } else if (right && !left) {
        player.vx = speed;
        player.facing = 1;
      } else {
        player.vx = 0;
      }

      if (
        (heldKeys.has("space") || heldKeys.has("w")) &&
        player.onGround &&
        !player.crouching
      ) {
        player.vy = JUMP_VEL;
        player.onGround = false;
      }


      // ===== Player physics: X axis =====
      player.x += player.vx;
      if (player.x < P_HALF_W) player.x = P_HALF_W;
      if (player.x > level.worldWidth - P_HALF_W) {
        player.x = level.worldWidth - P_HALF_W;
      }
      for (const p of platforms) {
        if (aabbHit(player.x, player.y, p)) {
          if (player.vx > 0) player.x = p.x - P_HALF_W;
          else if (player.vx < 0) player.x = p.x + p.w + P_HALF_W;
          player.vx = 0;
        }
      }

      // ===== Player physics: Y axis =====
      player.vy += GRAVITY;
      player.y += player.vy;
      player.onGround = false;
      if (player.y >= groundY) {
        player.y = groundY;
        player.vy = 0;
        player.onGround = true;
      }
      for (const p of platforms) {
        if (aabbHit(player.x, player.y, p)) {
          if (player.vy > 0) {
            player.y = p.y;
            player.vy = 0;
            player.onGround = true;
          } else if (player.vy < 0) {
            player.y = p.y + p.h + P_HEIGHT;
            player.vy = 0;
          } else {
            player.y = p.y;
            player.onGround = true;
          }
        }
      }

      // ===== Enemy AI =====
      for (let i = 0; i < enemies.length; i++) {
        tickEnemy(enemies[i], level.enemies[i]);
      }

      // ===== Detection =====
      let anySpotted = false;
      for (let i = 0; i < enemies.length; i++) {
        if (isInVisionCone(enemies[i], level.enemies[i], player, groundY)) {
          anySpotted = true;
          break;
        }
      }
      detectionFrames = anySpotted
        ? Math.min(detectionFrames + 1, 999)
        : Math.max(detectionFrames - 2, 0);

      // ===== Stealth kill (edge-triggered) =====
      // Computed once after physics — same target drives both the HUD
      // prompt and the kill action, so the rules can never drift.
      let stealthTarget = findStealthKillTarget(player, enemies, groundY);
      if (justPressed.has("e") && stealthTarget) {
        const enemy = enemies[stealthTarget.enemyIdx];
        killEnemy(enemy);
        if (stealthTarget.kind === "air") {
          // Drop onto the enemy's spot — satisfying "land into their place".
          player.x = enemy.x;
          player.y = groundY;
          player.vy = 0;
          player.onGround = true;
        }
        stealthTarget = null;
      }

      // ===== Camera =====
      const targetCamX = player.x - w / 2;
      const maxCamX = Math.max(0, level.worldWidth - w);
      camera.x += (targetCamX - camera.x) * CAMERA_LERP;
      if (camera.x < 0) camera.x = 0;
      if (camera.x > maxCamX) camera.x = maxCamX;

      // ===== Animation clock =====
      if (player.vx !== 0 && player.onGround) {
        player.animTime += sprinting ? 0.28 : 0.18;
      } else {
        player.animTime = 0;
      }

      // ===== Draw world =====
      ctx.clearRect(0, 0, w, h);
      ctx.save();
      ctx.translate(-camera.x, 0);

      drawGround(ctx, groundY, camera.x, w, level.worldWidth);
      drawPlatforms(ctx, platforms);
      drawEndMarker(ctx, groundY, level.worldWidth);

      // Vision cones under enemy sprites
      for (let i = 0; i < enemies.length; i++) {
        if (enemies[i].dead) continue;
        drawVisionCone(
          ctx,
          enemies[i],
          level.enemies[i],
          groundY,
          anySpotted
        );
      }
      for (let i = 0; i < enemies.length; i++) {
        drawEnemy(ctx, enemies[i], level.enemies[i], groundY);
      }

      drawShadow(ctx, player, groundY, platforms);
      drawCharacter(ctx, player);

      // Contextual prompt above the killable target (in world space)
      if (stealthTarget) {
        drawStealthKillPrompt(
          ctx,
          enemies[stealthTarget.enemyIdx],
          groundY,
          stealthTarget.kind
        );
      }

      ctx.restore();

      // ===== Draw HUD overlay (screen space) =====
      drawDetectionOverlay(ctx, w, h, detectionFrames);

      justPressed.clear();
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", onBlur);
      cancelAnimationFrame(raf);
    };
  }, [level]);

  return (
    <canvas
      ref={canvasRef}
      className="block"
      style={{ imageRendering: "auto" }}
    />
  );
}

// ===== Drawing =====

function drawGround(
  ctx: CanvasRenderingContext2D,
  groundY: number,
  cameraX: number,
  viewportW: number,
  worldWidth: number
) {
  ctx.strokeStyle = "rgba(234, 179, 8, 0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, groundY + 0.5);
  ctx.lineTo(worldWidth, groundY + 0.5);
  ctx.stroke();

  ctx.fillStyle = "rgba(234, 179, 8, 0.12)";
  for (let x = 0; x <= worldWidth; x += 100) {
    if (x < cameraX - 20 || x > cameraX + viewportW + 20) continue;
    ctx.fillRect(x, groundY + 2, 1, 4);
  }
}

function drawPlatforms(ctx: CanvasRenderingContext2D, platforms: Platform[]) {
  for (const p of platforms) {
    ctx.fillStyle = "rgba(15, 15, 15, 0.92)";
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = "rgba(234, 179, 8, 0.55)";
    ctx.fillRect(p.x, p.y, p.w, 1);
  }
}

function drawEndMarker(
  ctx: CanvasRenderingContext2D,
  groundY: number,
  worldWidth: number
) {
  const x = worldWidth - 40;
  const grad = ctx.createLinearGradient(0, groundY - 200, 0, groundY);
  grad.addColorStop(0, "rgba(234, 179, 8, 0)");
  grad.addColorStop(1, "rgba(234, 179, 8, 0.5)");
  ctx.fillStyle = grad;
  ctx.fillRect(x, groundY - 200, 2, 200);
}

function drawShadow(
  ctx: CanvasRenderingContext2D,
  s: PlayerState,
  groundY: number,
  platforms: Platform[]
) {
  let surfaceY = groundY;
  for (const p of platforms) {
    if (s.x + P_HALF_W > p.x && s.x - P_HALF_W < p.x + p.w) {
      if (p.y >= s.y && p.y < surfaceY) surfaceY = p.y;
    }
  }
  const heightAbove = Math.max(0, surfaceY - s.y);
  const scale = Math.max(0.3, 1 - heightAbove / 220);
  ctx.fillStyle = `rgba(0, 0, 0, ${0.4 * scale})`;
  ctx.beginPath();
  ctx.ellipse(s.x, surfaceY + 2, 16 * scale, 3 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawCharacter(ctx: CanvasRenderingContext2D, s: PlayerState) {
  const bob =
    s.onGround && s.vx !== 0 ? Math.abs(Math.sin(s.animTime)) * 1.5 : 0;
  const legSwing = s.onGround && s.vx !== 0 ? Math.sin(s.animTime) * 5 : 0;

  ctx.save();
  ctx.translate(s.x, s.y - bob);
  ctx.scale(s.facing, 1);

  if (s.crouching) {
    ctx.translate(0, 14);
    ctx.scale(1, 0.55);
  }

  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(-7 + legSwing * 0.4, -14, 5, 14);
  ctx.fillRect(2 - legSwing * 0.4, -14, 5, 14);
  ctx.fillRect(-9, -32, 18, 18);

  ctx.fillStyle = "#7a1a1a";
  ctx.fillRect(-9, -22, 18, 3);

  ctx.fillStyle = "#0a0a0a";
  ctx.beginPath();
  ctx.arc(0, -38, 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#171717";
  ctx.beginPath();
  ctx.moveTo(-12, -42);
  ctx.quadraticCurveTo(0, -50, 12, -42);
  ctx.lineTo(7, -30);
  ctx.lineTo(-7, -30);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.beginPath();
  ctx.arc(0, -36, 5.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawEnemy(
  ctx: CanvasRenderingContext2D,
  s: EnemyState,
  def: EnemyDef,
  groundY: number
) {
  if (def.kind === "templar-guard") {
    if (s.dead) {
      drawTemplarGuardDead(ctx, s, groundY);
    } else {
      drawTemplarGuardAlive(ctx, s, groundY);
    }
  }
}

function drawTemplarGuardAlive(
  ctx: CanvasRenderingContext2D,
  s: EnemyState,
  groundY: number
) {
  const bob = s.pauseFrames === 0 ? Math.abs(Math.sin(s.animTime)) * 1.2 : 0;
  const legSwing = s.pauseFrames === 0 ? Math.sin(s.animTime) * 4 : 0;

  ctx.save();
  ctx.translate(s.x, groundY - bob);
  ctx.scale(s.facing, 1);

  ctx.fillStyle = "#3a1414";
  ctx.fillRect(-7 + legSwing * 0.4, -14, 5, 14);
  ctx.fillRect(2 - legSwing * 0.4, -14, 5, 14);

  ctx.fillStyle = "#5c1c1c";
  ctx.fillRect(-10, -34, 20, 20);

  ctx.fillStyle = "#d4a73c";
  ctx.fillRect(-1, -32, 2, 16);
  ctx.fillRect(-7, -25, 14, 2);

  ctx.fillStyle = "#1f1110";
  ctx.beginPath();
  ctx.arc(0, -40, 7, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#7a5c20";
  ctx.beginPath();
  ctx.moveTo(-9, -42);
  ctx.lineTo(9, -42);
  ctx.lineTo(7, -34);
  ctx.lineTo(-7, -34);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawTemplarGuardDead(
  ctx: CanvasRenderingContext2D,
  s: EnemyState,
  groundY: number
) {
  // Slumped on the ground — wide rectangle along the floor.
  // Slight settle animation for the first ~15 frames.
  const settle = Math.min(1, s.deathTimer / 15);

  ctx.save();
  ctx.translate(s.x, groundY);
  ctx.scale(s.facing, 1);

  // Body (lying down — wide low rect)
  const bodyW = 26;
  const bodyH = 6 + (1 - settle) * 6; // slumps from taller to thinner
  ctx.fillStyle = "#3a1010";
  ctx.fillRect(-bodyW / 2, -bodyH, bodyW, bodyH);

  // Sash
  ctx.fillStyle = "#7a5c20";
  ctx.fillRect(-bodyW / 2 + 4, -bodyH + 1, 6, 2);

  // Head
  ctx.fillStyle = "#1f1110";
  ctx.beginPath();
  ctx.arc(bodyW / 2 - 2, -bodyH + 2, 5, 0, Math.PI * 2);
  ctx.fill();

  // Subtle pool of darkness under the body
  ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
  ctx.beginPath();
  ctx.ellipse(0, 2, bodyW / 2 + 4, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawVisionCone(
  ctx: CanvasRenderingContext2D,
  s: EnemyState,
  d: EnemyDef,
  groundY: number,
  alerted: boolean
) {
  const eyeX = s.x;
  const eyeY = groundY - GUARD_EYE_DY;

  ctx.save();
  ctx.translate(eyeX, eyeY);
  ctx.scale(s.facing, 1);

  const fill = alerted
    ? "rgba(220, 38, 38, 0.22)"
    : "rgba(234, 179, 8, 0.13)";
  const stroke = alerted
    ? "rgba(220, 38, 38, 0.55)"
    : "rgba(234, 179, 8, 0.35)";

  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(
    0,
    0,
    d.visionLength,
    d.visionCenterAngle - d.visionHalfAngle,
    d.visionCenterAngle + d.visionHalfAngle
  );
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

function drawStealthKillPrompt(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyState,
  groundY: number,
  kind: "ground" | "air"
) {
  const x = enemy.x;
  const y = groundY - 62;
  const pulse = 0.85 + 0.15 * Math.sin(performance.now() / 220);

  ctx.save();
  ctx.globalAlpha = pulse;

  // Air-kill prompt gets a small downward chevron above the circle
  // to signal "drop on them from here".
  if (kind === "air") {
    ctx.fillStyle = "rgba(234, 179, 8, 0.95)";
    ctx.beginPath();
    ctx.moveTo(x, y - 18);
    ctx.lineTo(x - 5, y - 25);
    ctx.lineTo(x + 5, y - 25);
    ctx.closePath();
    ctx.fill();
  }

  ctx.fillStyle = "rgba(0, 0, 0, 0.78)";
  ctx.strokeStyle = "rgba(234, 179, 8, 0.95)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "rgba(234, 179, 8, 1)";
  ctx.font =
    "600 12px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("E", x, y + 1);

  ctx.restore();
}

function drawDetectionOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  detectionFrames: number
) {
  if (detectionFrames <= 0) return;
  const intensity = Math.min(1, detectionFrames / 20);

  ctx.save();
  const grad = ctx.createRadialGradient(
    w / 2,
    h / 2,
    Math.min(w, h) * 0.2,
    w / 2,
    h / 2,
    Math.max(w, h) * 0.7
  );
  grad.addColorStop(0, "rgba(220, 38, 38, 0)");
  grad.addColorStop(1, `rgba(220, 38, 38, ${0.35 * intensity})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  if (detectionFrames > 6) {
    ctx.fillStyle = `rgba(255, 80, 80, ${Math.min(1, intensity * 1.2)})`;
    ctx.font = "600 11px ui-sans-serif, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const word = "DETECTED";
    const spacing = 7;
    const charW = ctx.measureText("D").width;
    const totalW = word.length * charW + (word.length - 1) * spacing;
    let cx = w / 2 - totalW / 2 + charW / 2;
    for (const ch of word) {
      ctx.fillText(ch, cx, 56);
      cx += charW + spacing;
    }
  }

  ctx.restore();
}
