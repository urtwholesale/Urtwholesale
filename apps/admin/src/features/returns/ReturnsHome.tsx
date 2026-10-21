import { useState } from "react";
import { triggerHaptic } from "../../utils/haptics";
import { ReturnsOverview } from "./ReturnsOverview";
import { ReturnTrackingList } from "./ReturnTrackingList";
import { ClaimTrackingList } from "./ClaimTrackingList";
import {
  RotateCcw,
  BarChart3,
  Truck,
  ShieldAlert,
  ExternalLink,
} from "lucide-react";

export type ReturnsTab = "overview" | "tracking" | "claims";

export function ReturnsHome() {
  const [activeTab, setActiveTab] = useState<ReturnsTab>("overview");
  const [trackingSearch, setTrackingSearch] = useState<string>("");
  const [trackingStatus, setTrackingStatus] = useState<string>("all");

  function handleSwitchToTracking(searchOrStatus?: string) {
    if (searchOrStatus === "requested") {
      setTrackingStatus("requested");
      setTrackingSearch("");
    } else if (searchOrStatus) {
      setTrackingSearch(searchOrStatus);
      setTrackingStatus("all");
    }
    setActiveTab("tracking");
    triggerHaptic("selection");
  }

  return (
    <div className="space-y-6">
      {/* ── Hub Header (Seller Hub Inspired) ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center text-sm shadow-xs">
              <RotateCcw className="w-4 h-4" />
            </div>
            <span>Return/RTO Orders</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Reverse logistics, wholesale customer RMA inspection, and supplier claim management
          </p>
        </div>

        {/* Support Help Action */}
        <a
          href="https://seller.urbanrat.com/returns-faq"
          target="_blank"
          rel="noreferrer"
          className="hidden sm:inline-flex items-center space-x-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs transition"
        >
          <span className="text-rose-500 font-black">▶</span>
          <span>How returns work?</span>
          <ExternalLink className="w-3 h-3 text-slate-400" />
        </a>
      </div>

      {/* ── Top-Level Tab Navigation: Overview | Return Tracking | Claim Tracking ── */}
      <div className="flex items-center space-x-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => {
            triggerHaptic("selection");
            setActiveTab("overview");
          }}
          className={`px-4 py-3 text-xs sm:text-sm font-black tracking-tight transition-all flex items-center space-x-2 border-b-2 cursor-pointer ${
            activeTab === "overview"
              ? "border-brand-dark text-slate-900"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Overview</span>
        </button>

        <button
          type="button"
          onClick={() => {
            triggerHaptic("selection");
            setActiveTab("tracking");
          }}
          className={`px-4 py-3 text-xs sm:text-sm font-black tracking-tight transition-all flex items-center space-x-2 border-b-2 cursor-pointer ${
            activeTab === "tracking"
              ? "border-brand-dark text-slate-900"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>Return Tracking</span>
        </button>

        <button
          type="button"
          onClick={() => {
            triggerHaptic("selection");
            setActiveTab("claims");
          }}
          className={`px-4 py-3 text-xs sm:text-sm font-black tracking-tight transition-all flex items-center space-x-2 border-b-2 cursor-pointer ${
            activeTab === "claims"
              ? "border-brand-dark text-slate-900"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>Claim Tracking</span>
        </button>
      </div>

      {/* ── Tab Views ── */}
      <div>
        {activeTab === "overview" && (
          <ReturnsOverview onSwitchToTracking={handleSwitchToTracking} />
        )}

        {activeTab === "tracking" && (
          <ReturnTrackingList
            initialSearchQuery={trackingSearch}
            initialStatusFilter={trackingStatus}
          />
        )}

        {activeTab === "claims" && <ClaimTrackingList />}
      </div>
    </div>
  );
}
