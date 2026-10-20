/**
 * Haptic Feedback Engine for Admin Panel
 * Utilizes standard Web Vibration API with safe fallback for all devices.
 */

export type HapticStyle = "light" | "medium" | "heavy" | "success" | "selection";

export function triggerHaptic(style: HapticStyle = "light"): void {
  if (typeof window === "undefined" || !("vibrate" in navigator)) {
    return;
  }

  try {
    switch (style) {
      case "selection":
        navigator.vibrate(8);
        break;
      case "light":
        navigator.vibrate(12);
        break;
      case "medium":
        navigator.vibrate(22);
        break;
      case "heavy":
        navigator.vibrate(35);
        break;
      case "success":
        navigator.vibrate([15, 40, 25]);
        break;
    }
  } catch {
    // Graceful fallback
  }
}

export function initGlobalHaptics(): () => void {
  if (typeof window === "undefined") return () => {};

  function handlePointerDown(e: PointerEvent) {
    const target = e.target as HTMLElement | null;
    if (!target) return;

    const interactive = target.closest<HTMLElement>(
      "button, a, [role='button'], input[type='submit'], .cursor-pointer, nav button, [data-haptic]"
    );

    if (interactive) {
      triggerHaptic("light");
    }
  }

  window.addEventListener("pointerdown", handlePointerDown, { passive: true });

  return () => {
    window.removeEventListener("pointerdown", handlePointerDown);
  };
}
