import { useEffect, useRef } from "react";

// Physics tuning
const GRAVITY = 0.7;
const JUMP_VEL = -13;
const WALK_SPEED = 3;
const RUN_SPEED = 5.5;
const GROUND_RATIO = 0.85; // ground sits at 85% down the viewport

type State = {
  x: number;
  y: number; // y of feet (ground-aligned)
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

export default function Platformer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;
    const ctxOrNull = canvasEl.getContext("2d");
    if (!ctxOrNull) return;
    // Re-bind as non-null locals so TS narrowing survives the inner closures.
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

      const sprinting = keys.has("shift");
      const speed = sprinting ? RUN_SPEED : WALK_SPEED;

      // Crouch only while grounded (and blocks horizontal move)
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

      // Jump (Space or W)
      if (
        (keys.has("space") || keys.has("w")) &&
        state.onGround &&
        !state.crouching
      ) {
        state.vy = JUMP_VEL;
        state.onGround = false;
      }

      // Gravity
      state.vy += GRAVITY;

      // Integrate
      state.x += state.vx;
      state.y += state.vy;

      // Side walls
      const halfWidth = 14;
      if (state.x < halfWidth) state.x = halfWidth;
      if (state.x > w - halfWidth) state.x = w - halfWidth;

      // Ground collision
      if (state.y >= groundY) {
        state.y = groundY;
        state.vy = 0;
        state.onGround = true;
      }

      // Animation clock advances only while running on ground
      if (state.vx !== 0 && state.onGround) {
        state.animTime += sprinting ? 0.28 : 0.18;
      } else {
        state.animTime = 0;
      }

      // ===== Draw =====
      ctx.clearRect(0, 0, w, h);

      // Ground line (subtle)
      ctx.strokeStyle = "rgba(234, 179, 8, 0.35)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, groundY + 0.5);
      ctx.lineTo(w, groundY + 0.5);
      ctx.stroke();

      // Shadow (squashes when jumping high)
      const heightAboveGround = Math.max(0, groundY - state.y);
      const shadowScale = Math.max(0.3, 1 - heightAboveGround / 220);
      ctx.fillStyle = `rgba(0, 0, 0, ${0.4 * shadowScale})`;
      ctx.beginPath();
      ctx.ellipse(
        state.x,
        groundY + 2,
        16 * shadowScale,
        3 * shadowScale,
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();

      drawCharacter(ctx, state);

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

function drawCharacter(ctx: CanvasRenderingContext2D, s: State) {
  const bob = s.onGround && s.vx !== 0 ? Math.abs(Math.sin(s.animTime)) * 1.5 : 0;
  const legSwing = s.onGround && s.vx !== 0 ? Math.sin(s.animTime) * 5 : 0;

  ctx.save();
  ctx.translate(s.x, s.y - bob);
  ctx.scale(s.facing, 1);

  // Crouch: compress vertically and shift down so feet stay on ground
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

  // Sash (the AC red)
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

  // Hood shadow over face
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.beginPath();
  ctx.arc(0, -36, 5.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}
