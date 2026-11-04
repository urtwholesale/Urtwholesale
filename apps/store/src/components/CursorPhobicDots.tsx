import { useEffect, useRef, useState, useCallback } from "react";
import { useTheme } from "../context/ThemeContext";

interface CursorPhobicDotsProps {
  className?: string;
  /** Distance between dots in px (default: 28) */
  spacing?: number;
  /** Radius of each dot in px (default: 1.4) */
  dotRadius?: number;
  /** Distance around cursor where repulsion occurs in px (default: 130) */
  repulsionRadius?: number;
  /** Maximum push displacement for a dot in px (default: 65) */
  maxDisplacement?: number;
  /** Spring stiffness factor (default: 0.09) */
  spring?: number;
  /** Velocity damping / friction (default: 0.76) */
  friction?: number;
}

interface Dot {
  x0: number; // rest anchor X
  y0: number; // rest anchor Y
  x: number;  // current animated X
  y: number;  // current animated Y
  vx: number; // current velocity X
  vy: number; // current velocity Y
}

export function CursorPhobicDots({
  className = "",
  spacing = 28,
  dotRadius = 1.5,
  repulsionRadius = 140,
  maxDisplacement = 75,
  spring = 0.1,
  friction = 0.78,
}: CursorPhobicDotsProps) {
  const { isDark } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dotsRef = useRef<Dot[]>([]);
  const mouseRef = useRef<{ x: number; y: number; active: boolean }>({
    x: -9999,
    y: -9999,
    active: false,
  });
  const rafIdRef = useRef<number | null>(null);
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

  // Initialize or re-create dots grid on resize
  const setupGrid = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const width = Math.max(10, Math.floor(rect.width));
    const height = Math.max(10, Math.floor(rect.height));

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // Generate Cartesian dot grid centered within width & height
    const cols = Math.ceil(width / spacing) + 1;
    const rows = Math.ceil(height / spacing) + 1;
    const startX = (width - (cols - 1) * spacing) / 2;
    const startY = (height - (rows - 1) * spacing) / 2;

    const newDots: Dot[] = [];
    for (let r = 0; r < rows; r++) {
      const y0 = startY + r * spacing;
      for (let c = 0; c < cols; c++) {
        const x0 = startX + c * spacing;
        newDots.push({
          x0,
          y0,
          x: x0,
          y: y0,
          vx: 0,
          vy: 0,
        });
      }
    }

    dotsRef.current = newDots;
  }, [spacing]);

  // Main animation / render loop
  const startLoop = useCallback(() => {
    if (isRunningRef.current) return;
    isRunningRef.current = true;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) {
        isRunningRef.current = false;
        return;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        isRunningRef.current = false;
        return;
      }

      const dpr = window.devicePixelRatio || 1;
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;

      ctx.clearRect(0, 0, width, height);

      const dots = dotsRef.current;
      const mouse = mouseRef.current;
      const mX = mouse.x;
      const mY = mouse.y;
      const mActive = mouse.active;

      let hasMotion = false;
      const r2 = repulsionRadius * repulsionRadius;

      // Draw all dots in a single batched canvas path for 60-120fps performance
      ctx.beginPath();

      for (let i = 0; i < dots.length; i++) {
        const dot = dots[i];
        if (!dot) continue;
        let targetX = dot.x0;
        let targetY = dot.y0;

        if (mActive) {
          const dx = dot.x0 - mX;
          const dy = dot.y0 - mY;
          const distSq = dx * dx + dy * dy;

          if (distSq < r2 && distSq > 0.0001) {
            const dist = Math.sqrt(distSq);
            // Smooth exponential falloff for natural repulsion bubble
            const ratio = 1 - dist / repulsionRadius;
            const force = ratio * ratio;
            const push = force * maxDisplacement;
            const invDist = 1 / dist;

            targetX = dot.x0 + dx * invDist * push;
            targetY = dot.y0 + dy * invDist * push;
          }
        }

        if (prefersReducedMotion) {
          dot.x = targetX;
          dot.y = targetY;
          dot.vx = 0;
          dot.vy = 0;
        } else {
          // Spring towards target + velocity damping
          const ax = (targetX - dot.x) * spring;
          const ay = (targetY - dot.y) * spring;
          dot.vx = (dot.vx + ax) * friction;
          dot.vy = (dot.vy + ay) * friction;
          dot.x += dot.vx;
          dot.y += dot.vy;

          // Micro-threshold resting check
          if (
            Math.abs(dot.vx) < 0.004 &&
            Math.abs(dot.vy) < 0.004 &&
            Math.abs(dot.x - targetX) < 0.01 &&
            Math.abs(dot.y - targetY) < 0.01
          ) {
            dot.x = targetX;
            dot.y = targetY;
            dot.vx = 0;
            dot.vy = 0;
          } else {
            hasMotion = true;
          }
        }

        // Add circle sub-path
        ctx.moveTo(dot.x + dotRadius, dot.y);
        ctx.arc(dot.x, dot.y, dotRadius, 0, Math.PI * 2);
      }

      // Crisp, high-contrast theme-aware color matching reference image
      ctx.fillStyle = isDark
        ? "rgba(241, 245, 249, 0.42)"
        : "rgba(15, 23, 42, 0.50)";
      ctx.fill();

      // If mouse is inactive and all dots have returned to rest, sleep to save 100% CPU
      if (!mActive && !hasMotion && !prefersReducedMotion) {
        isRunningRef.current = false;
        rafIdRef.current = null;
        return;
      }

      if (!prefersReducedMotion) {
        rafIdRef.current = requestAnimationFrame(render);
      } else {
        isRunningRef.current = false;
      }
    };

    rafIdRef.current = requestAnimationFrame(render);
  }, [repulsionRadius, maxDisplacement, spring, friction, dotRadius, isDark, prefersReducedMotion]);

  // Keep grid updated on mount and container/window resize
  useEffect(() => {
    setupGrid();
    startLoop();

    const handleResize = () => {
      setupGrid();
      startLoop();
    };

    window.addEventListener("resize", handleResize, { passive: true });

    const container = containerRef.current;
    let observer: ResizeObserver | null = null;
    if (container && typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => {
        setupGrid();
        startLoop();
      });
      observer.observe(container);
    }

    return () => {
      window.removeEventListener("resize", handleResize);
      if (observer) {
        observer.disconnect();
      }
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
      isRunningRef.current = false;
    };
  }, [setupGrid, startLoop]);

  // Window-level Pointer Tracking (captures cursor movement across every pixel of the page)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      let clientX = 0;
      let clientY = 0;

      if ("touches" in e) {
        const touch = e.touches[0];
        if (!touch) return;
        clientX = touch.clientX;
        clientY = touch.clientY;
      } else {
        clientX = (e as MouseEvent).clientX;
        clientY = (e as MouseEvent).clientY;
      }

      const rect = container.getBoundingClientRect();

      // Check if mouse is within proximity of the container
      const margin = repulsionRadius;
      if (
        clientX < rect.left - margin ||
        clientX > rect.right + margin ||
        clientY < rect.top - margin ||
        clientY > rect.bottom + margin
      ) {
        if (mouseRef.current.active) {
          mouseRef.current.active = false;
          startLoop();
        }
        return;
      }

      mouseRef.current.x = clientX - rect.left;
      mouseRef.current.y = clientY - rect.top;
      mouseRef.current.active = true;
      startLoop();
    };

    const handlePointerLeave = () => {
      if (mouseRef.current.active) {
        mouseRef.current.active = false;
        startLoop();
      }
    };

    window.addEventListener("mousemove", handlePointerMove, { passive: true });
    window.addEventListener("touchmove", handlePointerMove, { passive: true });
    window.addEventListener("mouseleave", handlePointerLeave, { passive: true });
    window.addEventListener("touchend", handlePointerLeave, { passive: true });
    window.addEventListener("touchcancel", handlePointerLeave, { passive: true });

    return () => {
      window.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("touchmove", handlePointerMove);
      window.removeEventListener("mouseleave", handlePointerLeave);
      window.removeEventListener("touchend", handlePointerLeave);
      window.removeEventListener("touchcancel", handlePointerLeave);
    };
  }, [repulsionRadius, startLoop]);

  // Re-render when theme changes
  useEffect(() => {
    startLoop();
  }, [isDark, startLoop]);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className={`pointer-events-none select-none overflow-hidden ${className}`}
    >
      <canvas
        ref={canvasRef}
        className="block w-full h-full"
      />
    </div>
  );
}
