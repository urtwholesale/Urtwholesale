/**
 * Haptic Feedback Engine
 * Utilizes the standard Web Vibration API with safe fallback for all devices.
 */

export type HapticStyle = "light" | "medium" | "heavy" | "success" | "selection";

/**
 * Trigger vibration pattern on supported mobile devices
 */
export function triggerHaptic(style: HapticStyle = "light"): void {
  if (typeof window === "undefined" || !("vibrate" in navigator)) {
    return;
  }

  try {
    switch (style) {
      case "selection":
        // Ultra-short micro-tap for tabs, navigation dock, chips (8ms)
        navigator.vibrate(8);
        break;
      case "light":
        // Light tap for regular buttons and links (12ms)
        navigator.vibrate(12);
        break;
      case "medium":
        // Medium tap for important actions like filters, toggles (22ms)
        navigator.vibrate(22);
        break;
      case "heavy":
        // Firm tap for deletions or critical actions (35ms)
        navigator.vibrate(35);
        break;
      case "success":
        // Rhythmic double-pulse for Add to Cart, Order Placed, Success ([15ms, 40ms pause, 25ms])
        navigator.vibrate([15, 40, 25]);
        break;
    }
  } catch {
    // Graceful fallback if permission or hardware is unavailable
  }
}

/**
 * Initializes global pointer event listener so ANY button, interactive link,
 * dock item, or menu option automatically triggers tactile haptic feedback.
 */
export function initGlobalHaptics(): () => void {
  if (typeof window === "undefined") return () => {};

  function handlePointerDown(e: PointerEvent) {
    const target = e.target as HTMLElement | null;
    if (!target) return;

    // Check if the touched element or any parent is interactive
    const interactive = target.closest<HTMLElement>(
      "button, a, [role='button'], input[type='submit'], .cursor-pointer, nav a, [data-haptic]"
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
