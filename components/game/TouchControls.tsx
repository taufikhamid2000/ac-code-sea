import { useEffect, useState } from "react";
import { touchControls, resetTouchControls } from "@/lib/game/touchControls";

/**
 * On-screen controls for touch devices. Buttons write to the shared
 * `touchControls` singleton that the Phaser scene reads each frame.
 * Rendered only when a coarse (touch) pointer is detected.
 */
export default function TouchControls() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const coarse =
      (typeof window !== "undefined" &&
        window.matchMedia?.("(pointer: coarse)").matches) ||
      (typeof window !== "undefined" && "ontouchstart" in window);
    setShow(Boolean(coarse));
    return () => resetTouchControls();
  }, []);

  if (!show) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-30 select-none">
      {/* Movement pad (bottom-left) */}
      <div className="absolute bottom-6 left-5 flex items-end gap-2">
        <HoldButton label="◀" onChange={(v) => (touchControls.left = v)} />
        <HoldButton label="▶" onChange={(v) => (touchControls.right = v)} />
        <HoldButton
          label="▼"
          onChange={(v) => (touchControls.down = v)}
          subtle
        />
      </div>

      {/* Action cluster (bottom-right) */}
      <div className="absolute bottom-6 right-5 flex items-end gap-3">
        <PressButton
          label="E"
          onPress={() => (touchControls.actionPressed = true)}
        />
        <HoldButton
          label="↥"
          big
          onChange={(v) => (touchControls.up = v)}
        />
      </div>
    </div>
  );
}

/** A button that sets a flag true while held. */
function HoldButton({
  label,
  onChange,
  big,
  subtle,
}: {
  label: string;
  onChange: (v: boolean) => void;
  big?: boolean;
  subtle?: boolean;
}) {
  return (
    <button
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        onChange(true);
      }}
      onPointerUp={() => onChange(false)}
      onPointerCancel={() => onChange(false)}
      onPointerLeave={() => onChange(false)}
      className={`pointer-events-auto flex touch-none items-center justify-center rounded-full border border-white/25 bg-black/35 font-bold text-white/85 backdrop-blur active:bg-white/25 ${
        big ? "h-20 w-20 text-2xl" : subtle ? "h-14 w-14 text-lg" : "h-16 w-16 text-xl"
      }`}
    >
      {label}
    </button>
  );
}

/** A button that fires once per tap (edge-triggered). */
function PressButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <button
      onPointerDown={(e) => {
        e.preventDefault();
        onPress();
      }}
      className="pointer-events-auto flex h-20 w-20 touch-none items-center justify-center rounded-full border border-yellow-500/50 bg-yellow-500/25 text-2xl font-bold text-yellow-200 backdrop-blur active:bg-yellow-500/40"
    >
      {label}
    </button>
  );
}
