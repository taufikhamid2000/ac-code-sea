import { useEffect, useRef } from "react";

// ===== Tuning =====
const GRAVITY = 0.7;
const JUMP_VEL = -13;
const WALK_SPEED = 3;
const RUN_SPEED = 5.5;
const GROUND_RATIO = 0.85; // ground sits at 85% down the viewport
const WORLD_WIDTH = 2000; // pixels
const CAMERA_LERP = 0.12; // 0..1 — higher = snappier follow

// Player bounding box (relative to feet point)
const P_HALF_W = 9;
const P_HEIGHT = 50; // top of head to feet

// Platforms — y stored as "dy above ground" so they re-align on resize.
type PlatformDef = { x: number; dy: number; w: number; h: number };
const PLATFORM_DEFS: PlatformDef[] = [
  { x: 460, dy: 90, w: 140, h: 14 },
  { x: 700, dy: 160, w: 140, h: 14 },
  { x: 970, dy: 100, w: 140, h: 14 },
  { x: 1270, dy: 200, w: 120, h: 14 },
  { x: 1520, dy: 110, w: 160, h: 14 },
];

type Platform = { x: number; y: number; w: number; h: number };

type State = {
  x: number;
  y: number; // world y of feet
  vx: number;
  vy: number;
  facing: 1 | -1;
  onGround: boolean;
  crouching: boolean;
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

export default function Platformer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;
    const ctxOrNull = canvasEl.getContext("2d");
    if (!ctxOrNull) return;
    const canvas: HTMLCanvasElement = canvasEl;
    const ctx: CanvasRenderingContext2D = ctxOrNull;

    const state: State = {
      x: 140,
      y: 0,
      vx: 0,
      vy: 0,
      facing: 1,
      onGround: false,
      crouching: false,
      animTime: 0,
    };
    const camera = { x: 0 };
    const keys = new Set<string>();

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

      // Materialize platforms in world coords for this frame.
      const platforms: Platform[] = PLATFORM_DEFS.map((p) => ({
        x: p.x,
        y: groundY - p.dy,
        w: p.w,
        h: p.h,
      }));

      // ===== Input =====
      const sprinting = keys.has("shift");
      const speed = sprinting ? RUN_SPEED : WALK_SPEED;
      state.crouching = keys.has("s") && state.onGround;

      const left = keys.has("a");
      const right = keys.has("d");
      if (state.crouching) {
        state.vx = 0;
      } else if (left && !right) {
        state.vx = -speed;
        state.facing = -1;
      } else if (right && !left) {
        state.vx = speed;
        state.facing = 1;
      } else {
        state.vx = 0;
      }

      if (
        (keys.has("space") || keys.has("w")) &&
        state.onGround &&
        !state.crouching
      ) {
        state.vy = JUMP_VEL;
        state.onGround = false;
      }

      // ===== Physics: X axis =====
      state.x += state.vx;

      // Clamp to world bounds
      if (state.x < P_HALF_W) state.x = P_HALF_W;
      if (state.x > WORLD_WIDTH - P_HALF_W) state.x = WORLD_WIDTH - P_HALF_W;

      // Resolve X collisions vs platforms (use current y for bbox)
      for (const p of platforms) {
        if (aabbHit(state.x, state.y, p)) {
          if (state.vx > 0) {
            state.x = p.x - P_HALF_W;
          } else if (state.vx < 0) {
            state.x = p.x + p.w + P_HALF_W;
          }
          state.vx = 0;
        }
      }

      // ===== Physics: Y axis =====
      state.vy += GRAVITY;
      state.y += state.vy;
      state.onGround = false;

      // Ground
      if (state.y >= groundY) {
        state.y = groundY;
        state.vy = 0;
        state.onGround = true;
      }

      // Resolve Y collisions vs platforms
      for (const p of platforms) {
        if (aabbHit(state.x, state.y, p)) {
          if (state.vy > 0) {
            // Landed on top
            state.y = p.y;
            state.vy = 0;
            state.onGround = true;
          } else if (state.vy < 0) {
            // Bonked head on underside
            state.y = p.y + p.h + P_HEIGHT;
            state.vy = 0;
          } else {
            // Stuck (shouldn't normally happen) — pop up
            state.y = p.y;
            state.onGround = true;
          }
        }
      }

      // ===== Camera =====
      const targetCamX = state.x - w / 2;
      const maxCamX = Math.max(0, WORLD_WIDTH - w);
      camera.x += (targetCamX - camera.x) * CAMERA_LERP;
      if (camera.x < 0) camera.x = 0;
      if (camera.x > maxCamX) camera.x = maxCamX;

      // ===== Animation clock =====
      if (state.vx !== 0 && state.onGround) {
        state.animTime += sprinting ? 0.28 : 0.18;
      } else {
        state.animTime = 0;
      }

      // ===== Draw =====
      ctx.clearRect(0, 0, w, h);
      ctx.save();
      ctx.translate(-camera.x, 0);

      drawGround(ctx, groundY, camera.x, w);
      drawPlatforms(ctx, platforms);
      drawEndMarker(ctx, groundY);
      drawShadow(ctx, state, groundY, platforms);
      drawCharacter(ctx, state);

      ctx.restore();

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
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="block"
      style={{ imageRendering: "auto" }}
    />
  );
}

function drawGround(
  ctx: CanvasRenderingContext2D,
  groundY: number,
  cameraX: number,
  viewportW: number
) {
  // Subtle ground line across the whole world
  ctx.strokeStyle = "rgba(234, 179, 8, 0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, groundY + 0.5);
  ctx.lineTo(WORLD_WIDTH, groundY + 0.5);
  ctx.stroke();

  // Tick marks every 100px for spatial reference (very subtle)
  ctx.fillStyle = "rgba(234, 179, 8, 0.12)";
  for (let x = 0; x <= WORLD_WIDTH; x += 100) {
    if (x < cameraX - 20 || x > cameraX + viewportW + 20) continue;
    ctx.fillRect(x, groundY + 2, 1, 4);
  }
}

function drawPlatforms(ctx: CanvasRenderingContext2D, platforms: Platform[]) {
  for (const p of platforms) {
    // Platform body
    ctx.fillStyle = "rgba(15, 15, 15, 0.92)";
    ctx.fillRect(p.x, p.y, p.w, p.h);
    // Top edge accent
    ctx.fillStyle = "rgba(234, 179, 8, 0.55)";
    ctx.fillRect(p.x, p.y, p.w, 1);
  }
}

function drawEndMarker(ctx: CanvasRenderingContext2D, groundY: number) {
  const x = WORLD_WIDTH - 40;
  // Vertical glow line
  const grad = ctx.createLinearGradient(0, groundY - 200, 0, groundY);
  grad.addColorStop(0, "rgba(234, 179, 8, 0)");
  grad.addColorStop(1, "rgba(234, 179, 8, 0.5)");
  ctx.fillStyle = grad;
  ctx.fillRect(x, groundY - 200, 2, 200);
}

function drawShadow(
  ctx: CanvasRenderingContext2D,
  s: State,
  groundY: number,
  platforms: Platform[]
) {
  // Find the highest surface directly below the player to project the shadow onto
  let surfaceY = groundY;
  for (const p of platforms) {
    if (s.x + P_HALF_W > p.x && s.x - P_HALF_W < p.x + p.w) {
      if (p.y >= s.y && p.y < surfaceY) {
        surfaceY = p.y;
      }
    }
  }
  const heightAbove = Math.max(0, surfaceY - s.y);
  const scale = Math.max(0.3, 1 - heightAbove / 220);
  ctx.fillStyle = `rgba(0, 0, 0, ${0.4 * scale})`;
  ctx.beginPath();
  ctx.ellipse(s.x, surfaceY + 2, 16 * scale, 3 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawCharacter(ctx: CanvasRenderingContext2D, s: State) {
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

  // Legs
  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(-7 + legSwing * 0.4, -14, 5, 14);
  ctx.fillRect(2 - legSwing * 0.4, -14, 5, 14);

  // Body
  ctx.fillRect(-9, -32, 18, 18);

  // Sash
  ctx.fillStyle = "#7a1a1a";
  ctx.fillRect(-9, -22, 18, 3);

  // Head
  ctx.fillStyle = "#0a0a0a";
  ctx.beginPath();
  ctx.arc(0, -38, 8, 0, Math.PI * 2);
  ctx.fill();

  // Hood drape
  ctx.fillStyle = "#171717";
  ctx.beginPath();
  ctx.moveTo(-12, -42);
  ctx.quadraticCurveTo(0, -50, 12, -42);
  ctx.lineTo(7, -30);
  ctx.lineTo(-7, -30);
  ctx.closePath();
  ctx.fill();

  // Hood face shadow
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.beginPath();
  ctx.arc(0, -36, 5.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}
