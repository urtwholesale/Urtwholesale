import { useState } from "react";
import {
  X,
  Sliders,
  Layers,
  Boxes,
  ImageIcon,
} from "lucide-react";
import type { CategoryNode } from "@urbanrat/shared";
import { BulkDetailsTab } from "./BulkDetailsTab";
import { BulkTiersTab } from "./BulkTiersTab";
import { BulkStockTab } from "./BulkStockTab";
import { BulkImagesTab } from "./BulkImagesTab";
import { triggerHaptic } from "../../../utils/haptics";

export interface BulkEditDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedProductIds: string[];
  selectedScopeLabel: string;
  categoryTree: CategoryNode[];
  onBulkSuccess: (result: { applied: number; skipped: number; opIds: string[] }) => void;
}

type TabKey = "details" | "tiers" | "stock" | "images";

export function BulkEditDrawer({
  isOpen,
  onClose,
  selectedProductIds,
  selectedScopeLabel,
  categoryTree,
  onBulkSuccess,
}: BulkEditDrawerProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("details");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden animate-fade-in">
      {/* ── Backdrop ── */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* ── Drawer Container ──
          Mobile: Full-screen sheet with bottom clearance for AdminNavigationDock
          Desktop (>= 1024px): Right drawer with max-w-2xl
      */}
      <div className="fixed inset-y-0 right-0 w-full lg:max-w-2xl bg-white shadow-2xl flex flex-col z-10 animate-slide-left">
        {/* ── Header ── */}
        <div className="px-5 py-4 border-b border-slate-200 bg-white shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-2xl bg-brand-light/30 border border-brand-light/50 flex items-center justify-center text-brand-dark">
                <Sliders className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                  Bulk Edit Products
                </h3>
                {/* Selected scope banner: Always shown in panel header */}
                <p className="text-xs font-semibold text-slate-500 flex items-center space-x-1 truncate max-w-md">
                  <span>{selectedScopeLabel}</span>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                triggerHaptic("selection");
                onClose();
              }}
              className="w-9 h-9 rounded-2xl border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* ── Navigation Tabs ── */}
          <div className="flex items-center space-x-1 mt-4 p-1 bg-slate-100 rounded-2xl">
            {[
              {
                id: "details" as TabKey,
                label: "Details",
                icon: Sliders,
              },
              {
                id: "tiers" as TabKey,
                label: "Price Tiers",
                icon: Layers,
              },
              {
                id: "stock" as TabKey,
                label: "Stock",
                icon: Boxes,
              },
              {
                id: "images" as TabKey,
                label: "Images",
                icon: ImageIcon,
              },
            ].map((tab) => {
              const isSelected = activeTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    triggerHaptic("selection");
                    setActiveTab(tab.id);
                  }}
                  className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center space-x-1.5 ${
                    isSelected
                      ? "bg-white text-brand-dark shadow-xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Scrollable Tab Body ──
            pb-32 on mobile ensures clear visibility above AdminNavigationDock
        */}
        <div className="flex-1 overflow-y-auto p-5 pb-32 lg:pb-8">
          {activeTab === "details" && (
            <BulkDetailsTab
              productIds={selectedProductIds}
              scopeLabel={selectedScopeLabel}
              categoryTree={categoryTree}
              onSuccess={(res) => {
                onBulkSuccess(res);
                onClose();
              }}
              onCancel={onClose}
            />
          )}

          {activeTab === "tiers" && (
            <BulkTiersTab
              productIds={selectedProductIds}
              scopeLabel={selectedScopeLabel}
              onSuccess={(res) => {
                onBulkSuccess(res);
                onClose();
              }}
              onCancel={onClose}
            />
          )}

          {activeTab === "stock" && (
            <BulkStockTab
              productIds={selectedProductIds}
              scopeLabel={selectedScopeLabel}
              onSuccess={(res) => {
                onBulkSuccess(res);
                onClose();
              }}
              onCancel={onClose}
            />
          )}

          {activeTab === "images" && (
            <BulkImagesTab
              productIds={selectedProductIds}
              scopeLabel={selectedScopeLabel}
              onSuccess={(res) => {
                onBulkSuccess(res);
                onClose();
              }}
              onCancel={onClose}
            />
          )}
        </div>
      </div>
    </div>
  );
}
