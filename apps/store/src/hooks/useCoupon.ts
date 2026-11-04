import { useState, useEffect, useRef, useCallback } from "react";
import { validateCoupon } from "../services/storeService";
import { triggerHaptic } from "../utils/haptics";
import { normalizeCouponCode } from "@urbanrat/shared";

export type CouponStatus = "idle" | "loading" | "applied" | "error";

export interface UseCouponOptions {
  items: Array<{ product_id: string; quantity: number }>;
  phone?: string | null;
}

export interface CouponState {
  code: string;
  status: CouponStatus;
  discountAmount: number;
  message: string;
  description?: string | null;
  subtotal?: number;
  finalTotal?: number;
}

export const COUPON_STORAGE_KEY = "urt_applied_coupon";

export function useCoupon({ items, phone }: UseCouponOptions) {
  const [state, setState] = useState<CouponState>(() => {
    return {
      code: "",
      status: "idle",
      discountAmount: 0,
      message: "",
      description: null,
    };
  });

  const isInitialMount = useRef(true);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const phoneRef = useRef(phone);
  phoneRef.current = phone;
  const stateRef = useRef(state);
  stateRef.current = state;

  // Apply a coupon code
  const apply = useCallback(
    async (rawCode: string): Promise<boolean> => {
      const normalized = normalizeCouponCode(rawCode);
      if (!normalized) {
        setState({
          code: "",
          status: "error",
          discountAmount: 0,
          message: "Please enter a valid coupon code",
          description: null,
        });
        triggerHaptic("heavy");
        return false;
      }

      setState((prev) => ({
        ...prev,
        status: "loading",
        message: "",
      }));

      try {
        const result = await validateCoupon(normalized, itemsRef.current, phoneRef.current);

        if (result.valid) {
          const discount = result.discount_amount ?? 0;
          setState({
            code: normalized,
            status: "applied",
            discountAmount: discount,
            message: result.message || "Coupon applied successfully",
            description: result.description || null,
            subtotal: result.subtotal,
            finalTotal: result.final_total,
          });

          try {
            sessionStorage.setItem(COUPON_STORAGE_KEY, normalized);
          } catch {
            // Ignore sessionStorage errors
          }

          triggerHaptic("success");
          return true;
        } else {
          setState({
            code: normalized,
            status: "error",
            discountAmount: 0,
            message: result.message || "Invalid coupon code",
            description: null,
          });

          triggerHaptic("heavy");
          return false;
        }
      } catch (err: any) {
        setState({
          code: normalized,
          status: "error",
          discountAmount: 0,
          message: err?.message || "Failed to validate coupon",
          description: null,
        });
        triggerHaptic("heavy");
        return false;
      }
    },
    []
  );

  // Remove the currently applied coupon
  const remove = useCallback(() => {
    setState({
      code: "",
      status: "idle",
      discountAmount: 0,
      message: "",
      description: null,
    });
    try {
      sessionStorage.removeItem(COUPON_STORAGE_KEY);
    } catch {
      // Ignore
    }
    triggerHaptic("light");
  }, []);

  // Restore coupon from sessionStorage on initial load
  useEffect(() => {
    if (!isInitialMount.current) return;
    isInitialMount.current = false;

    let savedCode: string | null = null;
    try {
      savedCode = sessionStorage.getItem(COUPON_STORAGE_KEY);
    } catch {
      // Ignore
    }

    if (savedCode && items.length > 0) {
      apply(savedCode);
    }
  }, [items.length, apply]);

  // Debounced auto re-validation when cart items, quantities, or phone change
  useEffect(() => {
    // Only re-validate if coupon is currently applied
    if (stateRef.current.status !== "applied" || !stateRef.current.code) {
      return;
    }

    // If cart was emptied, reset coupon
    if (items.length === 0) {
      remove();
      return;
    }

    const timer = setTimeout(async () => {
      const currentCode = stateRef.current.code;
      if (!currentCode || stateRef.current.status !== "applied") return;

      try {
        const result = await validateCoupon(currentCode, items, phone);

        if (result.valid) {
          setState((prev) => ({
            ...prev,
            discountAmount: result.discount_amount ?? 0,
            subtotal: result.subtotal,
            finalTotal: result.final_total,
            message: result.message || "Coupon applied",
          }));
        } else {
          // Drop the coupon with a friendly notification
          try {
            sessionStorage.removeItem(COUPON_STORAGE_KEY);
          } catch {
            // Ignore
          }

          setState({
            code: "",
            status: "idle",
            discountAmount: 0,
            message: `Coupon ${currentCode} was removed: ${result.message}`,
            description: null,
          });
          triggerHaptic("heavy");
        }
      } catch {
        // If revalidation fails due to network, keep current state silently
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [items, phone, remove]);

  return {
    code: state.code,
    status: state.status,
    discountAmount: state.discountAmount,
    message: state.message,
    description: state.description,
    subtotal: state.subtotal,
    finalTotal: state.finalTotal,
    isApplied: state.status === "applied",
    isLoading: state.status === "loading",
    error: state.status === "error" ? state.message : null,
    apply,
    remove,
  };
}

