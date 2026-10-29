"use client";

import { useEffect, useRef } from "react";

const LEFT_DOODLES = [
  "M50 14 L57.5 37.5 L82 37.5 L62.5 52 L70 76 L50 62 L30 76 L37.5 52 L18 37.5 L42.5 37.5 Z",
  "M64 54 C64 44 54 39 47 45 C39 52 41 63 51 65 C63 68 74 58 71 46 C68 32 52 27 40 37 C26 49 31 70 50 74 C72 79 88 60 82 42",
  "M50 28 A13 13 0 1 0 50.1 28 M50 8 V18 M50 64 V74 M24 41 H34 M66 41 H76 M33 24 L39 30 M67 24 L61 30 M33 58 L39 52 M67 58 L61 52",
  "M24 22 V74 H86 M24 74 C42 74 48 48 60 44 C74 39 80 28 92 24",
];

const RIGHT_DOODLES = [
  "M50 80 C50 80 18 56 18 38 C18 24 30 16 42 26 C47 31 50 36 50 40 C50 36 53 31 58 26 C70 16 82 24 82 38 C82 56 50 80 50 80",
  "M8 50 C20 30 32 30 44 50 S68 70 80 50 S104 30 112 50",
  "M68 20 C54 22 40 34 40 50 C40 68 56 80 70 80 C54 72 50 62 50 50 C50 36 56 28 68 20",
  "M18 46 L90 20 L56 78 L44 50 Z M44 50 L90 20",
];

function PageDoodles({ side }: { side: "left" | "right" }) {
  const paths = side === "left" ? LEFT_DOODLES : RIGHT_DOODLES;
  return (
    <div className={`doodle-stage doodle-stage-${side}`}>
      {paths.map((d, index) => (
        <svg
          key={d}
          className={`doodle doodle-${index + 1}${index === 0 ? " doodle-keep" : ""}`}
          viewBox={side === "right" && index === 1 ? "0 0 120 72" : "0 0 100 100"}
          aria-hidden="true"
        >
          <path className="ink" d={d} pathLength={1} />
        </svg>
      ))}
    </div>
  );
}

export function BookMark({ intro = false, coverTitle }: { intro?: boolean; coverTitle?: string } = {}) {
  const sceneRef = useRef<HTMLDivElement>(null);
  const orbitRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scene = sceneRef.current;
    const orbit = orbitRef.current;
    if (!scene || !orbit) return;

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduce = motionQuery.matches;
    let pointing = false;
    let targetX = 16;
    let targetY = -14;
    let currentX = 16;
    let currentY = -14;
    let targetTX = 0;
    let targetTY = 0;
    let currentTX = 0;
    let currentTY = 0;
    let frame = 0;
    const started = performance.now();

    function aim(clientX: number, clientY: number) {
      const rect = scene!.getBoundingClientRect();
      const px = Math.min(1, Math.max(-1, (clientX - rect.left) / rect.width * 2 - 1));
      const py = Math.min(1, Math.max(-1, (clientY - rect.top) / rect.height * 2 - 1));
      targetY = px * 22;
      targetX = 16 - py * 10;
      targetTX = px * (rect.width * 0.07);
      targetTY = py * (rect.height * 0.05);
    }

    function onPointerDown(event: PointerEvent) {
      downX = event.clientX;
      downY = event.clientY;
      pointing = true;
      try {
        scene!.setPointerCapture(event.pointerId);
      } catch {
        pointing = true;
      }
      aim(event.clientX, event.clientY);
    }

    function onPointerMove(event: PointerEvent) {
      if (event.pointerType === "touch" && !pointing) return;
      pointing = true;
      aim(event.clientX, event.clientY);
    }

    let taps = 0;
    let lastTap = 0;
    let downX = 0;
    let downY = 0;

    function release(event?: PointerEvent) {
      if (event && event.type === "pointerup") {
        const moved = Math.hypot(event.clientX - downX, event.clientY - downY);
        if (moved < 14) {
          const now = performance.now();
          taps = now - lastTap < 1600 ? taps + 1 : 1;
          lastTap = now;
          if (taps >= 5) {
            taps = 0;
            window.dispatchEvent(new Event("lessons:broom"));
          }
        }
      }
      pointing = false;
    }

    function onPointerLeave(event: PointerEvent) {
      if (event.buttons === 0) pointing = false;
    }

    function onMotionChange() {
      reduce = motionQuery.matches;
    }

    scene.addEventListener("pointerdown", onPointerDown);
    scene.addEventListener("pointermove", onPointerMove);
    scene.addEventListener("pointerup", release);
    scene.addEventListener("pointercancel", release);
    scene.addEventListener("pointerleave", onPointerLeave);
    motionQuery.addEventListener("change", onMotionChange);

    function tick(now: number) {
      if (!pointing) {
        if (reduce) {
          targetX = 16;
          targetY = -12;
          targetTX = 0;
          targetTY = 0;
        } else {
          const t = (now - started) / 1000;
          targetX = 16 + Math.sin(t * 0.65) * 3;
          targetY = Math.sin(t * 0.42) * 14;
          targetTX = Math.sin(t * 0.42) * 8;
          targetTY = Math.cos(t * 0.65) * 4;
        }
      }
      const ease = pointing ? 0.16 : 0.05;
      currentX += (targetX - currentX) * ease;
      currentY += (targetY - currentY) * ease;
      currentTX += (targetTX - currentTX) * ease;
      currentTY += (targetTY - currentTY) * ease;
      orbit!.style.transform = `translate3d(${currentTX.toFixed(2)}px, ${currentTY.toFixed(2)}px, 0) rotateX(${currentX.toFixed(2)}deg) rotateY(${currentY.toFixed(2)}deg)`;
      scene!.style.setProperty("--sheen-x", `${(50 - currentY * 2.4).toFixed(1)}%`);
      scene!.style.setProperty("--sheen-o", (0.18 + Math.abs(currentY) / 90).toFixed(3));
      frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      scene.removeEventListener("pointerdown", onPointerDown);
      scene.removeEventListener("pointermove", onPointerMove);
      scene.removeEventListener("pointerup", release);
      scene.removeEventListener("pointercancel", release);
      scene.removeEventListener("pointerleave", onPointerLeave);
      motionQuery.removeEventListener("change", onMotionChange);
    };
  }, []);

  return (
    <div ref={sceneRef} className={`spell-scene${intro ? " is-intro" : ""}`} aria-hidden="true">
      <div className="spell-glow" />
      <div ref={orbitRef} className="spell-orbit">
        <div className="spellbook">
          <div className="spell-board spell-board-left" />
          <div className="spell-board spell-board-right" />
          <div className="spell-pages">
            <div className="spell-sheet spell-sheet-left">
              <PageDoodles side="left" />
            </div>
            <div className="spell-sheet spell-sheet-right" />
            <div className="spell-leaf">
              <div className="spell-leaf-face spell-leaf-front" />
              <div className="spell-leaf-face spell-leaf-back" />
              <div className="spell-ink-on-leaf">
                <PageDoodles side="right" />
              </div>
            </div>
            <div className="spell-gutter" />
            <div className="spell-ribbon" />
            <div className="spell-sheen" />
          </div>
          {intro ? (
            <div className="spell-cover">
              <div className="spell-cover-face spell-cover-front">
                <span className="spell-cover-title">{coverTitle}</span>
              </div>
              <div className="spell-cover-face spell-cover-back" />
            </div>
          ) : null}
        </div>
      </div>
      <span className="mote mote-a" />
      <span className="mote mote-b" />
      <span className="mote mote-c" />
      <span className="mote mote-d" />
      <span className="mote mote-e" />
    </div>
  );
}
