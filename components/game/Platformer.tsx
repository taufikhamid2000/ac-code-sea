import { useEffect, useRef } from "react";
import type {
  GuardDef,
  LevelDef,
  PlatformDef,
} from "@/lib/levels";

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
const P_EYE_DY = 20; // eye/center offset above feet, for detection target

// Guard rendering / detection
const GUARD_HALF_W = 10;
const GUARD_EYE_DY = 36; // eye offset above ground (= near head height)

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

type GuardState = {
  x: number;
  facing: 1 | -1;
  pauseFrames: number;
  animTime: number;
};

const TRACKED_KEYS = new Set(["w", "a", "s", "d", "space", "shift"]);

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

function isInVisionCone(
  gState: GuardState,
  gDef: GuardDef,
  player: PlayerState,
  groundY: number
): boolean {
  const eyeX = gState.x;
  const eyeY = groundY - GUARD_EYE_DY;
  const targetX = player.x;
  const targetY = player.y - P_EYE_DY;

  const dx = targetX - eyeX;
  const dy = targetY - eyeY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist > gDef.visionLength) return false;

  // Project into guard's forward frame
  const forwardDx = dx * gState.facing;
  if (forwardDx <= 0) return false; // behind the guard

  const angle = Math.atan2(dy, forwardDx);
  return Math.abs(angle - gDef.visionCenterAngle) < gDef.visionHalfAngle;
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
    const guards: GuardState[] = level.guards.map((g) => ({
      x: g.startFacing === 1 ? g.patrolMinX : g.patrolMaxX,
      facing: g.startFacing,
      pauseFrames: 0,
      animTime: 0,
    }));
    const camera = { x: 0 };
    const keys = new Set<string>();
    let detectionFrames = 0; // frames spent in any cone

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
        keys.add(k);
      }
    }
    function onUp(e: KeyboardEvent) {
      keys.delete(normalizeKey(e));
    }
    function onBlur() {
      keys.clear();
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
      const sprinting = keys.has("shift");
      const speed = sprinting ? RUN_SPEED : WALK_SPEED;
      player.crouching = keys.has("s") && player.onGround;

      const left = keys.has("a");
      const right = keys.has("d");
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
        (keys.has("space") || keys.has("w")) &&
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

      // ===== Guard AI =====
      for (let i = 0; i < guards.length; i++) {
        const gs = guards[i];
        const gd = level.guards[i];
        if (gs.pauseFrames > 0) {
          gs.pauseFrames--;
          gs.animTime = 0;
          continue;
        }
        gs.x += gd.speed * gs.facing;
        gs.animTime += 0.15;
        if (gs.x >= gd.patrolMaxX) {
          gs.x = gd.patrolMaxX;
          gs.facing = -1;
          gs.pauseFrames = gd.pauseAtEnds;
        } else if (gs.x <= gd.patrolMinX) {
          gs.x = gd.patrolMinX;
          gs.facing = 1;
          gs.pauseFrames = gd.pauseAtEnds;
        }
      }

      // ===== Detection =====
      let anySpotted = false;
      for (let i = 0; i < guards.length; i++) {
        if (isInVisionCone(guards[i], level.guards[i], player, groundY)) {
          anySpotted = true;
          break;
        }
      }
      detectionFrames = anySpotted
        ? Math.min(detectionFrames + 1, 999)
        : Math.max(detectionFrames - 2, 0);

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

      // Vision cones go under guards so the guard's silhouette sits on top
      for (let i = 0; i < guards.length; i++) {
        drawVisionCone(ctx, guards[i], level.guards[i], groundY, anySpotted);
      }
      for (const gs of guards) {
        drawGuard(ctx, gs, groundY);
      }

      drawShadow(ctx, player, groundY, platforms);
      drawCharacter(ctx, player);

      ctx.restore();

      // ===== Draw HUD overlay (screen space, not world) =====
      drawDetectionOverlay(ctx, w, h, detectionFrames);

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

function drawGuard(
  ctx: CanvasRenderingContext2D,
  s: GuardState,
  groundY: number
) {
  const bob =
    s.pauseFrames === 0 ? Math.abs(Math.sin(s.animTime)) * 1.2 : 0;
  const legSwing = s.pauseFrames === 0 ? Math.sin(s.animTime) * 4 : 0;

  ctx.save();
  ctx.translate(s.x, groundY - bob);
  ctx.scale(s.facing, 1);

  // Legs
  ctx.fillStyle = "#3a1414";
  ctx.fillRect(-7 + legSwing * 0.4, -14, 5, 14);
  ctx.fillRect(2 - legSwing * 0.4, -14, 5, 14);

  // Body (Templar red)
  ctx.fillStyle = "#5c1c1c";
  ctx.fillRect(-10, -34, 20, 20);

  // Cross / sash
  ctx.fillStyle = "#d4a73c";
  ctx.fillRect(-1, -32, 2, 16);
  ctx.fillRect(-7, -25, 14, 2);

  // Head
  ctx.fillStyle = "#1f1110";
  ctx.beginPath();
  ctx.arc(0, -40, 7, 0, Math.PI * 2);
  ctx.fill();

  // Helmet
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

function drawVisionCone(
  ctx: CanvasRenderingContext2D,
  s: GuardState,
  d: GuardDef,
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

function drawDetectionOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  detectionFrames: number
) {
  if (detectionFrames <= 0) return;

  // Red vignette intensifies the longer you're spotted (caps fast)
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
    // Manual letter-spacing — ctx.letterSpacing is not in older TS lib types.
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
