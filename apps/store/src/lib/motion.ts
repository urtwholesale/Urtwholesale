import { useEffect, useState, useMemo, useCallback } from "react";
import {
  LazyMotion,
  domAnimation,
  m,
  AnimatePresence,
  useReducedMotion as useFramerReducedMotion,
  type Variants,
  type Transition,
} from "motion/react";
import { triggerHaptic, type HapticStyle } from "../utils/haptics";

// ── Motion Tokens: Single Source of Truth ──

export const MOTION_DURATIONS = {
  instant: 0.12,
  fast: 0.2,
  base: 0.32,
  slow: 0.5,
} as const;

export const MOTION_EASINGS = {
  // Apple/Linear style crisp deceleration
  easeOut: [0.22, 1, 0.36, 1] as const,
  // Smooth natural enter/exit
  easeInOut: [0.65, 0, 0.35, 1] as const,
  // Extreme fluid expo
  easeOutExpo: [0.16, 1, 0.3, 1] as const,
} as const;

export const MOTION_SPRINGS = {
  // Snappy tab highlights, pill switches, small icons
  snappy: {
    type: "spring",
    stiffness: 500,
    damping: 38,
    mass: 1,
  } as const,
  // Soft floating elements, tooltips, cards
  soft: {
    type: "spring",
    stiffness: 260,
    damping: 28,
    mass: 1,
  } as const,
  // Sheet drag and modal slide-ups
  sheet: {
    type: "spring",
    stiffness: 380,
    damping: 36,
    mass: 1,
  } as const,
} as const;

// ── Low-End Device Detection ──
// Targets Indian 4G wholesale buyers on mid/low-tier Android devices
export function checkIsLowEndDevice(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }

  // 1. CPU cores check (<= 4 cores indicates budget mobile SoC)
  const concurrency = navigator.hardwareConcurrency ?? 8;
  if (concurrency <= 4) return true;

  // 2. RAM check (<= 2GB / 3GB device memory API)
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean; effectiveType?: string };
  };
  if (nav.deviceMemory && nav.deviceMemory <= 3) return true;

  // 3. User enabled Data Saver on their mobile browser
  if (nav.connection?.saveData) return true;

  // 4. Slow 2G/3G network
  if (nav.connection?.effectiveType && ["slow-2g", "2g"].includes(nav.connection.effectiveType)) {
    return true;
  }

  return false;
}

export function useIsLowEndDevice(): boolean {
  const [isLowEnd, setIsLowEnd] = useState<boolean>(() => checkIsLowEndDevice());

  useEffect(() => {
    setIsLowEnd(checkIsLowEndDevice());
  }, []);

  return isLowEnd;
}

// ── Accessible Reduced Motion Hook ──
export function useMotionPreferences() {
  const prefersReduced = useFramerReducedMotion();
  const isLowEnd = useIsLowEndDevice();

  // Downgrade if user requests reduced motion OR device is constrained
  const shouldReduce = Boolean(prefersReduced);
  const shouldSimplify = shouldReduce || isLowEnd;

  return {
    prefersReduced: shouldReduce,
    isLowEnd,
    shouldSimplify,
  };
}

// ── Reusable Variant Generators ──

export const createMotionVariants = (reduced: boolean = false) => {
  if (reduced) {
    return {
      fadeUp: {
        initial: { opacity: 0 },
        animate: { opacity: 1, transition: { duration: MOTION_DURATIONS.fast } },
        exit: { opacity: 0, transition: { duration: MOTION_DURATIONS.instant } },
      } satisfies Variants,
      fadeIn: {
        initial: { opacity: 0 },
        animate: { opacity: 1, transition: { duration: MOTION_DURATIONS.fast } },
        exit: { opacity: 0, transition: { duration: MOTION_DURATIONS.instant } },
      } satisfies Variants,
      scaleIn: {
        initial: { opacity: 0 },
        animate: { opacity: 1, transition: { duration: MOTION_DURATIONS.fast } },
        exit: { opacity: 0, transition: { duration: MOTION_DURATIONS.instant } },
      } satisfies Variants,
      sheetSlideUp: {
        initial: { opacity: 0 },
        animate: { opacity: 1, transition: { duration: MOTION_DURATIONS.fast } },
        exit: { opacity: 0, transition: { duration: MOTION_DURATIONS.instant } },
      } satisfies Variants,
      pressTap: {
        scale: 1,
      },
      staggerContainer: {
        initial: {},
        animate: { transition: { staggerChildren: 0 } },
      } satisfies Variants,
    };
  }

  return {
    // 8px subtle translation for calm, non-distracting elevation
    fadeUp: {
      initial: { opacity: 0, y: 8 },
      animate: {
        opacity: 1,
        y: 0,
        transition: {
          duration: MOTION_DURATIONS.base,
          ease: MOTION_EASINGS.easeOut,
        },
      },
      exit: {
        opacity: 0,
        y: -4,
        transition: {
          duration: MOTION_DURATIONS.fast,
          ease: MOTION_EASINGS.easeInOut,
        },
      },
    } satisfies Variants,

    fadeIn: {
      initial: { opacity: 0 },
      animate: {
        opacity: 1,
        transition: {
          duration: MOTION_DURATIONS.fast,
          ease: MOTION_EASINGS.easeOut,
        },
      },
      exit: {
        opacity: 0,
        transition: {
          duration: MOTION_DURATIONS.instant,
          ease: MOTION_EASINGS.easeInOut,
        },
      },
    } satisfies Variants,

    scaleIn: {
      initial: { opacity: 0, scale: 0.96 },
      animate: {
        opacity: 1,
        scale: 1,
        transition: {
          ...MOTION_SPRINGS.snappy,
        },
      },
      exit: {
        opacity: 0,
        scale: 0.98,
        transition: {
          duration: MOTION_DURATIONS.fast,
        },
      },
    } satisfies Variants,

    sheetSlideUp: {
      initial: { y: "100%", opacity: 0.8 },
      animate: {
        y: 0,
        opacity: 1,
        transition: {
          ...MOTION_SPRINGS.sheet,
        },
      },
      exit: {
        y: "100%",
        opacity: 0,
        transition: {
          duration: MOTION_DURATIONS.fast,
          ease: MOTION_EASINGS.easeInOut,
        },
      },
    } satisfies Variants,

    // Subtle 0.97 scale press feedback
    pressTap: {
      scale: 0.97,
      transition: {
        duration: MOTION_DURATIONS.instant,
        ease: MOTION_EASINGS.easeOut,
      },
    },

    // 0.04s stagger, capped at 12 items to prevent long delays on wholesale listings
    staggerContainer: {
      initial: {},
      animate: {
        transition: {
          staggerChildren: 0.04,
          delayChildren: 0.02,
        },
      },
    } satisfies Variants,
  };
};

export const defaultVariants = createMotionVariants(false);
export const reducedVariants = createMotionVariants(true);

// ── Interactive Tap with Haptic Wrapper ──
export function useTapAnimation(haptic: HapticStyle = "selection") {
  const { prefersReduced } = useMotionPreferences();

  const handleTapStart = useCallback(() => {
    triggerHaptic(haptic);
  }, [haptic]);

  const tapProps = useMemo(() => {
    if (prefersReduced) {
      return {
        onPointerDown: handleTapStart,
      };
    }
    return {
      whileTap: defaultVariants.pressTap,
      onPointerDown: handleTapStart,
    };
  }, [prefersReduced, handleTapStart]);

  return tapProps;
}

// ── Re-exports for Zero-Bloat DOM Motion ──
export { LazyMotion, domAnimation, m, AnimatePresence };
export type { Variants, Transition };

