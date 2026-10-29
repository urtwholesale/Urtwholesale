import { useState } from "react";
import type { Order, OrderItem } from "@urbanrat/shared";
import { triggerHaptic } from "../utils/haptics";
import { useSettings } from "../context/SettingsContext";
import {
  X,
  AlertTriangle,
  MessageCircle,
  CheckCircle2,
  ChevronRight,
  ShieldAlert,
} from "lucide-react";

export interface ReturnReportIssueModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
}

const ISSUE_REASONS = [
  "DOA (Dead on Arrival / Not Powering On)",
  "Damaged in Transit (Broken glass / torn box)",
  "Wrong Item Dispatched (SKU / Color mismatch)",
  "Shortage / Missing quantity in shipment",
  "Quality Defect / Charging port loose",
  "Other Wholesale Dispatch Issue",
] as const;

export function ReturnReportIssueModal({
  isOpen,
  onClose,
  order,
}: ReturnReportIssueModalProps) {
  const { whatsappNumber } = useSettings();

  const [selectedItemIndex, setSelectedItemIndex] = useState<number>(-1); // -1 = entire order
  const [selectedReason, setSelectedReason] = useState<string>(ISSUE_REASONS[0]);
  const [description, setDescription] = useState("");
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen || !order) return null;

  const targetWhatsApp = whatsappNumber || "919999999999";

  const selectedItem: OrderItem | undefined =
    selectedItemIndex >= 0 ? order.items[selectedItemIndex] : undefined;

  const prefilledText = `Hi URT Wholesale Resolution Desk,
I want to report an issue for Order #${order.id}:
- Issue: ${selectedReason}
${selectedItem ? `- Affected Item: ${selectedItem.name} (Qty: ${selectedItem.quantity}, SKU: ${selectedItem.sku || "N/A"})` : "- Affected: Entire Order"}
${description.trim() ? `- Details: ${description.trim()}` : ""}
- Customer: ${order.customer?.name || "Customer"} (${order.customer?.phone || ""})
Please arrange a replacement / credit under the 1-Year Wholesale Warranty.`;

  const whatsappUrl = `https://wa.me/${targetWhatsApp.replace(/\D/g, "")}?text=${encodeURIComponent(
    prefilledText
  )}`;

  function handleOpenWhatsApp() {
    triggerHaptic("success");
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
    setSubmitted(true);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 dark:bg-black/80 backdrop-blur-xs animate-in fade-in"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full sm:max-w-lg bg-white dark:bg-slate-900 rounded-t-4xl sm:rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 max-h-[92vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300">
        {/* Mobile handle */}
        <div className="sm:hidden pt-3 pb-1 flex justify-center">
          <div className="w-10 h-1 bg-slate-200 dark:bg-slate-700 rounded-full" />
        </div>

        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="font-black text-sm sm:text-base text-slate-900 dark:text-white">
                Return &amp; Issue Resolution
              </h2>
              <p className="text-[11px] text-slate-400 dark:text-slate-400 font-medium">
                Order #{order.id} &bull; 1-Year Wholesale Warranty
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white cursor-pointer transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {submitted ? (
            <div className="py-8 text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 stroke-[2.2]" />
              </div>
              <h3 className="font-black text-base text-slate-900 dark:text-white">
                Request Sent to Support
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                Your report has been forwarded to our wholesale replacement desk. An agent will respond on WhatsApp within business hours with courier pickup details or credit.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    background: "var(--brand-gradient)",
                    boxShadow: "var(--brand-shadow)",
                  }}
                  className="px-5 py-2.5 rounded-xl text-white font-bold text-xs transition cursor-pointer hover:opacity-95"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Item selection if multi-item */}
              {order.items.length > 1 && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                    Select Affected Item
                  </label>
                  <div className="space-y-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic("selection");
                        setSelectedItemIndex(-1);
                      }}
                      className={`w-full p-2.5 rounded-xl border text-left text-xs font-bold flex items-center justify-between transition cursor-pointer ${
                        selectedItemIndex === -1
                          ? "border-brand-dark dark:border-orange-500 bg-sky-50/40 dark:bg-orange-500/10 text-brand-dark dark:text-orange-400 ring-1 ring-brand-dark dark:ring-orange-500/30"
                          : "border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                      }`}
                    >
                      <span>Entire Consignment / Multiple Items</span>
                      <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                    </button>

                    {order.items.map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          triggerHaptic("selection");
                          setSelectedItemIndex(idx);
                        }}
                        className={`w-full p-2.5 rounded-xl border text-left text-xs flex items-center justify-between transition cursor-pointer ${
                          selectedItemIndex === idx
                            ? "border-brand-dark dark:border-orange-500 bg-sky-50/40 dark:bg-orange-500/10 font-bold text-brand-dark dark:text-orange-400 ring-1 ring-brand-dark dark:ring-orange-500/30"
                            : "border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium"
                        }`}
                      >
                        <div className="truncate mr-2">
                          <span className="text-slate-900 dark:text-white">{item.name}</span>
                          <span className="text-[11px] text-slate-400 dark:text-slate-500 block font-normal">
                            Qty: {item.quantity} &bull; ₹{item.unit_price || item.price}
                          </span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Issue Reason Radio/Dropdown */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Nature of the Issue <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedReason}
                  onChange={(e) => {
                    triggerHaptic("selection");
                    setSelectedReason(e.target.value);
                  }}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white focus:border-brand-dark dark:focus:border-brand focus:bg-white dark:focus:bg-slate-800 transition"
                >
                  {ISSUE_REASONS.map((r) => (
                    <option key={r} value={r} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              {/* Additional Details */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Brief Description &amp; Fault Details
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. 2 pieces out of 10 do not power on when plugged into 65W outlet. Serial numbers: ..."
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-brand-dark dark:focus:border-brand focus:bg-white dark:focus:bg-slate-800 transition resize-none"
                />
              </div>

              {/* Wholesale SLA Notice */}
              <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/50 text-[11px] text-amber-800 dark:text-amber-300 space-y-1">
                <p className="font-bold flex items-center space-x-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>Wholesale Warranty &amp; DOA SLA</span>
                </p>
                <p className="text-amber-700 dark:text-amber-200 leading-relaxed font-normal">
                  All Urbanrat hardware is backed by a 1-year replacement warranty. For transit damage or DOA, report within 48 hours for immediate replacement dispatch.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        {!submitted && (
          <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end space-x-2.5 bg-slate-50/50 dark:bg-slate-900/60">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleOpenWhatsApp}
              className="px-5 py-2.5 rounded-xl text-white font-black text-xs transition active:scale-[0.98] shadow-sm cursor-pointer flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Connect with Resolution Desk</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
