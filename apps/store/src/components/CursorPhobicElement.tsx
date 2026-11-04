import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";

// ── Shared Window Pointer Listener (Zero-overhead singleton for all elements) ──
type PointerListener = (x: number, y: number, active: boolean) => void;
const subscribers = new Set<PointerListener>();

let pointerInitialized = false;
let mouseX = -9999;
let mouseY = -9999;
let pointerActive = false;

function initSharedPointer() {
  if (pointerInitialized || typeof window === "undefined") return;
  pointerInitialized = true;

  const onPointerMove = (e: MouseEvent | TouchEvent) => {
    if ("touches" in e) {
      const touch = e.touches[0];
      if (!touch) return;
      mouseX = touch.clientX;
      mouseY = touch.clientY;
    } else {
      mouseX = (e as MouseEvent).clientX;
      mouseY = (e as MouseEvent).clientY;
    }
    pointerActive = true;
    for (const listener of subscribers) {
      listener(mouseX, mouseY, true);
    }
  };

  const onPointerLeave = () => {
    pointerActive = false;
    for (const listener of subscribers) {
      listener(-9999, -9999, false);
    }
  };

  window.addEventListener("mousemove", onPointerMove, { passive: true });
  window.addEventListener("touchmove", onPointerMove, { passive: true });
  window.addEventListener("mouseleave", onPointerLeave, { passive: true });
  window.addEventListener("touchend", onPointerLeave, { passive: true });
  window.addEventListener("touchcancel", onPointerLeave, { passive: true });
}

export function subscribePointer(listener: PointerListener) {
  initSharedPointer();
  subscribers.add(listener);
  // Send initial state immediately
  if (pointerActive) {
    listener(mouseX, mouseY, true);
  }
  return () => {
    subscribers.delete(listener);
  };
}

export interface CursorPhobicElementProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  /** Distance around element center where repulsion occurs (default: 170) */
  repulsionRadius?: number;
  /** Maximum displacement in px when repelled (default: 28) */
  maxDisplacement?: number;
  /** Maximum 3D tilt in degrees when repelled (default: 0) */
  maxTilt?: number;
  /** Spring stiffness factor (default: 0.12) */
  spring?: number;
  /** Velocity damping / friction (default: 0.78) */
  friction?: number;
  /** HTML Tag type (default: 'div') */
  as?: "div" | "span" | "h1" | "h2" | "h3" | "p";
  /** Optional scale factor during repulsion (default: 1) */
  scaleOnRepel?: number;
  /** Direction invert (true = attract towards cursor, false = phobic repel away, default: false) */
  invert?: boolean;
}

/**
 * CursorPhobicElement
 * Smoothly scatters / diverges away from the user's cursor with spring physics.
 * Directly updates CSS transform for 60-120fps hardware acceleration with zero React re-renders.
 */
export function CursorPhobicElement({
  children,
  className = "",
  style = {},
  repulsionRadius = 170,
  maxDisplacement = 28,
  maxTilt = 0,
  spring = 0.12,
  friction = 0.78,
  as = "div",
  scaleOnRepel = 1,
  invert = false,
}: CursorPhobicElementProps) {
  const domRef = useRef<HTMLElement | null>(null);

  // Motion physics state
  const stateRef = useRef({
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    tiltX: 0,
    tiltY: 0,
    vTiltX: 0,
    vTiltY: 0,
    targetX: 0,
    targetY: 0,
    targetTiltX: 0,
    targetTiltY: 0,
    targetScale: 1,
    scale: 1,
    vScale: 0,
  });

  const rafRef = useRef<number | null>(null);
  const isRunningRef = useRef(false);

  // Check prefers-reduced-motion
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(media.matches);
    const listener = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, []);

  const startLoop = useCallback(() => {
    if (isRunningRef.current || prefersReducedMotion) return;
    isRunningRef.current = true;

    const tick = () => {
      const el = domRef.current;
      if (!el) {
        isRunningRef.current = false;
        return;
      }

      const s = stateRef.current;

      // Spring physics towards target
      const ax = (s.targetX - s.x) * spring;
      const ay = (s.targetY - s.y) * spring;
      s.vx = (s.vx + ax) * friction;
      s.vy = (s.vy + ay) * friction;
      s.x += s.vx;
      s.y += s.vy;

      // Tilt physics
      if (maxTilt > 0) {
        const aTiltX = (s.targetTiltX - s.tiltX) * spring;
        const aTiltY = (s.targetTiltY - s.tiltY) * spring;
        s.vTiltX = (s.vTiltX + aTiltX) * friction;
        s.vTiltY = (s.vTiltY + aTiltY) * friction;
        s.tiltX += s.vTiltX;
        s.tiltY += s.vTiltY;
      }

      // Scale physics
      if (scaleOnRepel !== 1) {
        const aScale = (s.targetScale - s.scale) * spring;
        s.vScale = (s.vScale + aScale) * friction;
        s.scale += s.vScale;
      }

      // Check resting threshold
      const isResting =
        Math.abs(s.vx) < 0.005 &&
        Math.abs(s.vy) < 0.005 &&
        Math.abs(s.x - s.targetX) < 0.01 &&
        Math.abs(s.y - s.targetY) < 0.01 &&
        Math.abs(s.vTiltX) < 0.005 &&
        Math.abs(s.tiltX - s.targetTiltX) < 0.01 &&
        Math.abs(s.vTiltY) < 0.005 &&
        Math.abs(s.tiltY - s.targetTiltY) < 0.01;

      if (isResting) {
        s.x = s.targetX;
        s.y = s.targetY;
        s.tiltX = s.targetTiltX;
        s.tiltY = s.targetTiltY;
        s.scale = s.targetScale;
        s.vx = 0;
        s.vy = 0;
        s.vTiltX = 0;
        s.vTiltY = 0;
        s.vScale = 0;
      }

      // Apply transform directly to DOM
      const tiltTransform =
        maxTilt > 0
          ? `perspective(900px) rotateX(${s.tiltX.toFixed(2)}deg) rotateY(${s.tiltY.toFixed(2)}deg) `
          : "";
      const scaleTransform = scaleOnRepel !== 1 ? `scale(${s.scale.toFixed(3)}) ` : "";

      el.style.transform = `translate3d(${s.x.toFixed(2)}px, ${s.y.toFixed(2)}px, 0) ${tiltTransform}${scaleTransform}`;

      if (isResting && s.targetX === 0 && s.targetY === 0) {
        isRunningRef.current = false;
        rafRef.current = null;
        return;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [spring, friction, maxTilt, scaleOnRepel, prefersReducedMotion]);

  useEffect(() => {
    const unsubscribe = subscribePointer((pX, pY, active) => {
      const el = domRef.current;
      if (!el || prefersReducedMotion) return;

      const s = stateRef.current;

      if (!active) {
        s.targetX = 0;
        s.targetY = 0;
        s.targetTiltX = 0;
        s.targetTiltY = 0;
        s.targetScale = 1;
        startLoop();
        return;
      }

      const rect = el.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const dx = centerX - pX;
      const dy = centerY - pY;
      const distSq = dx * dx + dy * dy;
      const r2 = repulsionRadius * repulsionRadius;

      if (distSq < r2 && distSq > 0.0001) {
        const dist = Math.sqrt(distSq);
        // Exponential falloff ratio (strongest at center, smoothly fading towards perimeter)
        const ratio = 1 - dist / repulsionRadius;
        const force = ratio * ratio * maxDisplacement;
        const invDist = 1 / dist;

        const dirMultiplier = invert ? -1 : 1;
        s.targetX = dx * invDist * force * dirMultiplier;
        s.targetY = dy * invDist * force * dirMultiplier;

        if (maxTilt > 0) {
          s.targetTiltX = -dy * invDist * (ratio * maxTilt) * dirMultiplier;
          s.targetTiltY = dx * invDist * (ratio * maxTilt) * dirMultiplier;
        }

        if (scaleOnRepel !== 1) {
          s.targetScale = 1 + (scaleOnRepel - 1) * ratio;
        }
      } else {
        s.targetX = 0;
        s.targetY = 0;
        s.targetTiltX = 0;
        s.targetTiltY = 0;
        s.targetScale = 1;
      }

      startLoop();
    });

    return () => {
      unsubscribe();
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      isRunningRef.current = false;
    };
  }, [repulsionRadius, maxDisplacement, maxTilt, scaleOnRepel, invert, prefersReducedMotion, startLoop]);

  const Component = as as React.ElementType;

  return (
    <Component
      ref={(node: HTMLElement | null) => {
        domRef.current = node;
      }}
      className={`will-change-transform ${className}`}
      style={style}
    >
      {children}
    </Component>
  );
}

/**
 * CursorPhobicWords
 * Splits a text string into individual words, each with its own independent
 * cursor-phobic divergence vector. When cursor moves through the text, words
 * dynamically part and scatter outward, springing back when the cursor leaves.
 */
export function CursorPhobicWords({
  text,
  className = "",
  wordClassName = "",
  repulsionRadius = 160,
  maxDisplacement = 24,
  maxTilt = 6,
}: {
  text: string;
  className?: string;
  wordClassName?: string;
  repulsionRadius?: number;
  maxDisplacement?: number;
  maxTilt?: number;
}) {
  const words = useMemo(() => text.split(/\s+/).filter(Boolean), [text]);

  return (
    <span className={`inline-flex flex-wrap items-baseline gap-x-[0.3em] ${className}`}>
      {words.map((word, idx) => (
        <CursorPhobicElement
          key={`${word}-${idx}`}
          as="span"
          repulsionRadius={repulsionRadius}
          maxDisplacement={maxDisplacement}
          maxTilt={maxTilt}
          className={`inline-block ${wordClassName}`}
        >
          {word}
        </CursorPhobicElement>
      ))}
    </span>
  );
}
