import { useState } from "react";
import type { OrderNoticeCounts, SellerHubTab } from "@urbanrat/shared";
import {
  Clock,
  AlertTriangle,
  Truck,
  AlertCircle,
  X,
  ChevronRight,
} from "lucide-react";

interface OrderNoticesStripProps {
  counts: OrderNoticeCounts | null;
  onFilterTab: (tab: SellerHubTab) => void;
}

const STORAGE_KEY_DISMISSED = "urt_admin_dismissed_notices";

export function OrderNoticesStrip({ counts, onFilterTab }: OrderNoticesStripProps) {
  const [dismissed, setDismissed] = useState<Record<string, boolean>>(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY_DISMISSED);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  function handleDismiss(key: string) {
    setDismissed((prev) => {
      const next = { ...prev, [key]: true };
      try {
        sessionStorage.setItem(STORAGE_KEY_DISMISSED, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }

  if (!counts) return null;

  const notices = [
    // 1. Pending orders older than 24 hours (Urgent SLA)
    counts.delayed_pending_count > 0 && !dismissed["delayed_pending"] && {
      key: "delayed_pending",
      type: "warning" as const,
      icon: Clock,
      title: "Action Required: Delayed Pending Orders",
      message: `${counts.delayed_pending_count} pending wholesale ${
        counts.delayed_pending_count === 1 ? "order was" : "orders were"
      } placed over 24 hours ago and need immediate review to meet your next-day dispatch SLA.`,
      ctaLabel: "Process Pending Orders",
      onCta: () => onFilterTab("pending"),
      bgClass: "bg-linear-to-r from-amber-500/10 via-amber-500/5 to-transparent border-amber-300/80 text-amber-950",
      iconBg: "bg-amber-100 text-amber-800",
      ctaBg: "bg-amber-800 text-white hover:bg-amber-900",
    },

    // 2. Ready to ship orders queued for carrier dispatch
    counts.ready_to_ship_count > 0 && !dismissed["ready_to_ship"] && {
      key: "ready_to_ship",
      type: "info" as const,
      icon: Truck,
      title: "Dispatch Queue: Orders Ready to Ship",
      message: `${counts.ready_to_ship_count} confirmed ${
        counts.ready_to_ship_count === 1 ? "order is" : "orders are"
      } packed and ready for carrier pickup & AWB generation.`,
      ctaLabel: "View Ready to Ship",
      onCta: () => onFilterTab("ready_to_ship"),
      bgClass: "bg-linear-to-r from-blue-500/10 via-blue-500/5 to-transparent border-blue-200 text-blue-950",
      iconBg: "bg-blue-100 text-blue-800",
      ctaBg: "bg-blue-800 text-white hover:bg-blue-900",
    },

    // 3. Orders on hold
    counts.on_hold_count > 0 && !dismissed["on_hold"] && {
      key: "on_hold",
      type: "alert" as const,
      icon: AlertCircle,
      title: "Consignments On Hold",
      message: `${counts.on_hold_count} ${
        counts.on_hold_count === 1 ? "order is" : "orders are"
      } on hold pending customer address clarification or verification.`,
      ctaLabel: "View On Hold Orders",
      onCta: () => onFilterTab("on_hold"),
      bgClass: "bg-linear-to-r from-orange-500/10 via-orange-500/5 to-transparent border-orange-200 text-orange-950",
      iconBg: "bg-orange-100 text-orange-800",
      ctaBg: "bg-orange-800 text-white hover:bg-orange-900",
    },

    // 4. Low warehouse stock
    counts.low_stock_count > 0 && !dismissed["low_stock"] && {
      key: "low_stock",
      type: "purple" as const,
      icon: AlertTriangle,
      title: "Warehouse Inventory Alert",
      message: `${counts.low_stock_count} catalog ${
        counts.low_stock_count === 1 ? "item has" : "items have"
      } 10 or fewer units in warehouse stock. Replenish inventory to avoid fulfillment shortages.`,
      ctaLabel: null,
      onCta: null,
      bgClass: "bg-linear-to-r from-purple-500/10 via-purple-500/5 to-transparent border-purple-200 text-purple-950",
      iconBg: "bg-purple-100 text-purple-800",
      ctaBg: "",
    },
  ].filter(Boolean) as {
    key: string;
    type: string;
    icon: any;
    title: string;
    message: string;
    ctaLabel: string | null;
    onCta: (() => void) | null;
    bgClass: string;
    iconBg: string;
    ctaBg: string;
  }[];

  if (notices.length === 0) return null;

  return (
    <div className="space-y-3">
      {notices.map((n) => {
        const IconComponent = n.icon;
        return (
          <div
            key={n.key}
            className={`p-4 sm:p-4.5 rounded-3xl border shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 transition-all ${n.bgClass}`}
          >
            <div className="flex items-start space-x-3.5 min-w-0">
              <div
                className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${n.iconBg}`}
              >
                <IconComponent className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="font-black text-xs sm:text-sm text-slate-900 tracking-tight">
                  {n.title}
                </h4>
                <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                  {n.message}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
              {n.ctaLabel && n.onCta && (
                <button
                  type="button"
                  onClick={n.onCta}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer shadow-xs flex items-center space-x-1 ${n.ctaBg}`}
                >
                  <span>{n.ctaLabel}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => handleDismiss(n.key)}
                title="Dismiss notice"
                className="w-8 h-8 rounded-full bg-white/80 hover:bg-white text-slate-400 hover:text-slate-700 flex items-center justify-center transition cursor-pointer border border-black/5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
