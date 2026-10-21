import { useState, useId } from "react";
import { Link, useNavigate } from "react-router";
import type {
  Order,
  OrderItem,
  ReturnType,
  ReturnReasonCode,
  ReturnRequest,
  CreateReturnItemInput,
} from "@urbanrat/shared";
import {
  RETURN_REASON_CODES,
  RETURN_REASON_LABELS,
} from "@urbanrat/shared";
import { triggerHaptic } from "../utils/haptics";
import { useAuth } from "../context/AuthContext";
import {
  createReturnRequest,
  uploadReturnEvidence,
} from "../services/returnService";
import { formatBytes } from "../utils/imageCompressor";
import {
  X,
  Package,
  CheckCircle2,
  AlertTriangle,
  Upload,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Check,
  ShieldCheck,
  FileText,
  RotateCcw,
  Sparkles,
} from "lucide-react";

export interface ReturnRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  onSuccess?: (returnReq: ReturnRequest) => void;
}

interface SelectedItemState {
  selected: boolean;
  quantity: number;
}

export function ReturnRequestModal({
  isOpen,
  onClose,
  order,
  onSuccess,
}: ReturnRequestModalProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const evidenceInputId = useId();

  // Wizard Steps: 1: Pick Items, 2: Choose Reason & Type, 3: Evidence & Review, 4: Success
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1: Items Selection
  const [itemsState, setItemsState] = useState<Record<number, SelectedItemState>>({});

  // Step 2: Return Type, Reason, Description
  const [returnType, setReturnType] = useState<ReturnType>("replacement");
  const [reasonCode, setReasonCode] = useState<ReturnReasonCode>("defective");
  const [description, setDescription] = useState("");

  // Step 3: Evidence Files
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Step 4: Created Return Result
  const [createdReturn, setCreatedReturn] = useState<ReturnRequest | null>(null);

  if (!isOpen || !order) return null;

  // Initialize or get item selection state
  function getItemState(idx: number, item: OrderItem): SelectedItemState {
    if (itemsState[idx]) return itemsState[idx]!;
    return {
      selected: idx === 0, // default first item selected
      quantity: item.quantity,
    };
  }

  function handleToggleItem(idx: number, item: OrderItem) {
    triggerHaptic("selection");
    setItemsState((prev) => {
      const current = prev[idx] || { selected: false, quantity: item.quantity };
      return {
        ...prev,
        [idx]: {
          ...current,
          selected: !current.selected,
          quantity: current.quantity > 0 ? current.quantity : item.quantity,
        },
      };
    });
    setError(null);
  }

  function handleQuantityChange(idx: number, item: OrderItem, qty: number) {
    triggerHaptic("selection");
    const clamped = Math.max(1, Math.min(item.quantity, qty));
    setItemsState((prev) => {
      const current = prev[idx] || { selected: true, quantity: item.quantity };
      return {
        ...prev,
        [idx]: {
          ...current,
          quantity: clamped,
        },
      };
    });
  }

  // Count selected items
  const selectedEntries = order.items
    .map((item, idx) => ({ item, idx, state: getItemState(idx, item) }))
    .filter((entry) => entry.state.selected);

  function handleNextToStep2() {
    if (selectedEntries.length === 0) {
      setError("Please select at least one item to return or replace");
      triggerHaptic("heavy");
      return;
    }
    setError(null);
    triggerHaptic("light");
    setStep(2);
  }

  function handleNextToStep3() {
    if (!description.trim()) {
      setError("Please describe the issue or defect");
      triggerHaptic("heavy");
      return;
    }
    setError(null);
    triggerHaptic("light");
    setStep(3);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files;
    if (!selected || selected.length === 0) return;

    triggerHaptic("light");
    const newFiles = Array.from(selected);

    // Limit to 5 total files
    if (files.length + newFiles.length > 5) {
      setError("You can upload a maximum of 5 photos or videos as evidence");
      triggerHaptic("heavy");
      return;
    }

    // Validate size (max 20MB per file)
    for (const f of newFiles) {
      if (f.size > 20 * 1024 * 1024) {
        setError(`File "${f.name}" exceeds 20MB limit`);
        triggerHaptic("heavy");
        return;
      }
    }

    setError(null);
    setFiles((prev) => [...prev, ...newFiles]);
  }

  function handleRemoveFile(index: number) {
    triggerHaptic("selection");
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmitReturn() {
    if (!order) {
      setError("No order selected");
      return;
    }

    if (!user) {
      setError("Please sign in to submit a return request");
      return;
    }

    if (files.length === 0) {
      setError("Please upload at least 1 photo or video evidence of the product issue");
      triggerHaptic("heavy");
      return;
    }

    setSubmitting(true);
    setError(null);
    triggerHaptic("light");

    try {
      // 1. Upload evidence files
      const uploadedPaths: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i]!;
        setUploadProgress(`Uploading evidence ${i + 1} of ${files.length}...`);
        const path = await uploadReturnEvidence(file, user.id);
        uploadedPaths.push(path);
      }

      setUploadProgress("Submitting return request...");

      // 2. Prepare items payload
      const returnItemsPayload: CreateReturnItemInput[] = selectedEntries.map(
        ({ item, state }) => ({
          product_id: item.product_id,
          quantity: state.quantity,
          order_item_id: item.sku || undefined,
          reason_code: reasonCode,
          condition: "unopened",
        })
      );

      // 3. Create Return Request via RPC
      const result = await createReturnRequest({
        order_id: order.id,
        items: returnItemsPayload,
        type: returnType,
        reason: reasonCode,
        description: description.trim(),
        evidence_paths: uploadedPaths,
      });

      triggerHaptic("success");
      setCreatedReturn(result);
      setStep(4);
      if (onSuccess) onSuccess(result);
    } catch (err: unknown) {
      console.error("Failed to submit return:", err);
      const e = err as Error;
      setError(e.message || "Failed to submit return request. Please retry.");
      triggerHaptic("heavy");
    } finally {
      setSubmitting(false);
      setUploadProgress(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/55 backdrop-blur-xs animate-in fade-in">
      <div
        className="relative w-full sm:max-w-2xl bg-white rounded-t-4xl sm:rounded-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[92vh] overflow-hidden animate-in slide-in-from-bottom duration-300"
        role="dialog"
        aria-modal="true"
      >
        {/* Mobile handle */}
        <div className="sm:hidden pt-3 pb-1 flex justify-center">
          <div className="w-10 h-1 bg-slate-200 rounded-full" />
        </div>

        {/* ── Top Header Bar ── */}
        <div className="p-4 sm:p-5 pb-3 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-800 flex items-center justify-center border border-amber-200/70">
              <RotateCcw className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="font-black text-sm sm:text-base text-slate-900 leading-tight">
                {step === 4 ? "Return Submitted" : "Request Return / Replacement"}
              </h2>
              <p className="text-[11px] text-slate-500 font-medium">
                Order #{order.id} &bull; 1-Year Wholesale Warranty
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Step Indicator Progress Bar (Steps 1 to 3) ── */}
        {step < 4 && (
          <div className="px-5 pt-3 pb-2 bg-slate-50 border-b border-slate-100">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 mb-1.5">
              <span className={step >= 1 ? "text-brand-dark" : ""}>
                1. Select Items
              </span>
              <span className={step >= 2 ? "text-brand-dark" : ""}>
                2. Reason &amp; Type
              </span>
              <span className={step >= 3 ? "text-brand-dark" : ""}>
                3. Evidence &amp; Submit
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-linear-to-r from-brand-light to-brand-dark transition-all duration-300"
                style={{
                  width: step === 1 ? "33%" : step === 2 ? "66%" : "100%",
                }}
              />
            </div>
          </div>
        )}

        {/* ── Scrollable Body ── */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start space-x-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="font-medium">{error}</div>
            </div>
          )}

          {/* ════════════ STEP 1: PICK ITEMS & QUANTITIES ════════════ */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-700">
                  Select which items from this order you want to return or replace:
                </p>
                <span className="text-[11px] font-bold text-slate-400">
                  {selectedEntries.length} of {order.items.length} selected
                </span>
              </div>

              <div className="space-y-3">
                {order.items.map((item, idx) => {
                  const state = getItemState(idx, item);
                  const unitPrice = item.unit_price || item.price || 0;

                  return (
                    <div
                      key={idx}
                      className={`p-3.5 rounded-2xl border transition-all ${
                        state.selected
                          ? "border-brand-dark bg-sky-50/30 shadow-2xs"
                          : "border-slate-200/80 bg-white opacity-85 hover:opacity-100"
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        {/* Checkbox */}
                        <button
                          type="button"
                          onClick={() => handleToggleItem(idx, item)}
                          className={`mt-1 w-5 h-5 rounded-lg border flex items-center justify-center transition cursor-pointer shrink-0 ${
                            state.selected
                              ? "bg-brand-dark border-brand-dark text-white"
                              : "border-slate-300 bg-white hover:border-slate-400"
                          }`}
                        >
                          {state.selected && <Check className="w-3.5 h-3.5 stroke-3" />}
                        </button>

                        {/* Thumbnail */}
                        <div className="w-14 h-14 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                          {item.image ? (
                            <img
                              src={item.image}
                              alt={item.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Package className="w-6 h-6 text-slate-300" />
                          )}
                        </div>

                        {/* Details */}
                        <div className="min-w-0 flex-1 space-y-1">
                          <p className="font-bold text-xs sm:text-sm text-slate-900 leading-snug">
                            {item.name}
                          </p>

                          <div className="flex items-center space-x-2 text-[11px] text-slate-500">
                            {item.sku && <span>SKU: {item.sku}</span>}
                            <span>&bull;</span>
                            <span>Delivered: <strong>{item.quantity} pcs</strong></span>
                          </div>

                          <p className="text-xs font-semibold text-slate-700">
                            ₹{unitPrice.toLocaleString("en-IN")} / pc
                          </p>
                        </div>
                      </div>

                      {/* Quantity Selector (when selected) */}
                      {state.selected && (
                        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                          <span className="text-slate-600 font-medium">
                            Quantity to return / replace:
                          </span>

                          <div className="flex items-center space-x-2">
                            <button
                              type="button"
                              onClick={() =>
                                handleQuantityChange(idx, item, state.quantity - 1)
                              }
                              disabled={state.quantity <= 1}
                              className="w-7 h-7 rounded-lg border border-slate-200 bg-white text-slate-700 font-bold hover:bg-slate-100 disabled:opacity-40 transition cursor-pointer"
                            >
                              -
                            </button>

                            <input
                              type="number"
                              min={1}
                              max={item.quantity}
                              value={state.quantity}
                              onChange={(e) =>
                                handleQuantityChange(
                                  idx,
                                  item,
                                  parseInt(e.target.value) || 1
                                )
                              }
                              className="w-14 py-1 text-center font-bold text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-brand-dark"
                            />

                            <button
                              type="button"
                              onClick={() =>
                                handleQuantityChange(idx, item, state.quantity + 1)
                              }
                              disabled={state.quantity >= item.quantity}
                              className="w-7 h-7 rounded-lg border border-slate-200 bg-white text-slate-700 font-bold hover:bg-slate-100 disabled:opacity-40 transition cursor-pointer"
                            >
                              +
                            </button>

                            <span className="text-[11px] text-slate-400 pl-1">
                              (max {item.quantity})
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ════════════ STEP 2: CHOOSE REASON + TYPE + DESCRIPTION ════════════ */}
          {step === 2 && (
            <div className="space-y-4">
              {/* Return Type Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-2">
                  What resolution would you like?
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {[
                    {
                      id: "replacement",
                      title: "Replacement",
                      desc: "Dispatch fresh tested units under warranty",
                      icon: Sparkles,
                      color: "text-brand-dark bg-sky-50 border-sky-200",
                    },
                    {
                      id: "return",
                      title: "Return & Credit",
                      desc: "Send back items for store credit note",
                      icon: RotateCcw,
                      color: "text-amber-700 bg-amber-50 border-amber-200",
                    },
                    {
                      id: "refund",
                      title: "Direct Refund",
                      desc: "Refund back to original source/bank",
                      icon: FileText,
                      color: "text-emerald-700 bg-emerald-50 border-emerald-200",
                    },
                  ].map((t) => {
                    const isSelected = returnType === t.id;
                    const Icon = t.icon;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          triggerHaptic("selection");
                          setReturnType(t.id as ReturnType);
                        }}
                        className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                          isSelected
                            ? "border-brand-dark bg-sky-50/40 shadow-xs"
                            : "border-slate-200 hover:border-slate-300 bg-white"
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          <div className={`p-1.5 rounded-lg border ${t.color}`}>
                            <Icon className="w-3.5 h-3.5" />
                          </div>
                          <span className="font-bold text-xs text-slate-900">
                            {t.title}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1.5 leading-snug">
                          {t.desc}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Reason Code Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-2">
                  Select Reason for Return
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {RETURN_REASON_CODES.map((code) => {
                    const isSelected = reasonCode === code;
                    return (
                      <label
                        key={code}
                        onClick={() => triggerHaptic("selection")}
                        className={`flex items-start space-x-2.5 p-3 rounded-xl border text-xs cursor-pointer transition ${
                          isSelected
                            ? "border-brand-dark bg-sky-50/30 text-slate-900 font-bold"
                            : "border-slate-200 hover:border-slate-300 text-slate-700 font-medium"
                        }`}
                      >
                        <input
                          type="radio"
                          name="reason_code"
                          checked={isSelected}
                          onChange={() => setReasonCode(code)}
                          className="mt-0.5 text-brand-dark"
                        />
                        <span className="leading-tight">
                          {RETURN_REASON_LABELS[code]}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Detailed Description */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  Detailed Description &bull; Serial numbers or defect notes:
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="E.g. Box arrived with torn seal, 3 units of Type-C cable not powering on when tested on multimeter..."
                  className="w-full p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs sm:text-sm font-medium text-slate-900 outline-none focus:border-brand-dark focus:bg-white transition"
                />
              </div>
            </div>
          )}

          {/* ════════════ STEP 3: EVIDENCE UPLOAD & FINAL REVIEW ════════════ */}
          {step === 3 && (
            <div className="space-y-4">
              {/* Evidence Upload Section */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-800">
                    Upload Photos / Videos (1 to 5 files):
                  </label>
                  <span className="text-[11px] font-bold text-slate-400">
                    {files.length} / 5 files
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mb-3">
                  Upload clear photos showing the damaged product, carton box label, or short video of the defect.
                  Images are automatically compressed to WebP for fast upload.
                </p>

                {/* Upload Area */}
                {files.length < 5 && (
                  <label
                    htmlFor={evidenceInputId}
                    className="flex flex-col items-center justify-center p-5 border-2 border-dashed border-slate-200 hover:border-brand-dark rounded-2xl bg-slate-50 hover:bg-sky-50/20 transition cursor-pointer"
                  >
                    <Upload className="w-6 h-6 text-slate-400 mb-1.5" />
                    <span className="text-xs font-bold text-slate-700">
                      Click to choose photos or videos
                    </span>
                    <span className="text-[10px] text-slate-400 mt-0.5">
                      JPG, PNG, WEBP, MP4 &bull; Max 20MB per file
                    </span>
                    <input
                      id={evidenceInputId}
                      type="file"
                      multiple
                      accept="image/*,video/mp4,video/quicktime,video/webm"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </label>
                )}

                {/* Thumbnails preview */}
                {files.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mt-3">
                    {files.map((file, idx) => (
                      <div
                        key={idx}
                        className="relative p-2 rounded-xl bg-white border border-slate-200 flex items-center space-x-2 text-xs"
                      >
                        <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                          {file.type.startsWith("image/") ? (
                            <img
                              src={URL.createObjectURL(file)}
                              alt="preview"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <FileText className="w-5 h-5 text-slate-400" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-slate-800 text-[11px] truncate">
                            {file.name}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {formatBytes(file.size)}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveFile(idx)}
                          className="w-5 h-5 rounded-full bg-slate-100 hover:bg-rose-100 hover:text-rose-600 flex items-center justify-center text-slate-400 transition cursor-pointer shrink-0"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Order & Return Summary Card */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5 text-xs text-slate-600">
                <div className="flex justify-between pb-2 border-b border-slate-200/60">
                  <span className="font-bold text-slate-800">Resolution Requested:</span>
                  <span className="font-bold uppercase text-brand-dark">
                    {returnType}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span>Reason Category:</span>
                  <span className="font-semibold text-slate-800">
                    {RETURN_REASON_LABELS[reasonCode]}
                  </span>
                </div>

                <div>
                  <span className="font-semibold text-slate-800 block mb-1">
                    Items to Return ({selectedEntries.length}):
                  </span>
                  <div className="space-y-1">
                    {selectedEntries.map(({ item, state }, i) => (
                      <div key={i} className="flex justify-between text-[11px] text-slate-700">
                        <span className="truncate pr-2">
                          &bull; {item.name}
                        </span>
                        <span className="font-bold shrink-0">
                          Qty: {state.quantity}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200/60 flex items-center space-x-1.5 text-emerald-800 font-semibold text-[11px]">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>QC &amp; doorstep pickup arranged within 24-48 business hours.</span>
                </div>
              </div>
            </div>
          )}

          {/* ════════════ STEP 4: SUCCESS VIEW ════════════ */}
          {step === 4 && createdReturn && (
            <div className="py-6 text-center space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200 shadow-xs">
                <CheckCircle2 className="w-8 h-8 stroke-[2.2]" />
              </div>

              <div className="space-y-1.5">
                <h3 className="text-lg font-black text-slate-900">
                  Return Request Created!
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Your request has been registered under wholesale return code:
                </p>
                <div className="inline-block py-1.5 px-4 rounded-xl bg-slate-100 border border-slate-200 font-mono font-black text-sm text-slate-900">
                  {createdReturn.return_code}
                </div>
              </div>

              <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
                Our QC team will review your evidence and dispatch logistics instructions.
                You can track live status anytime in your returns dashboard.
              </p>

              <div className="pt-3 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    navigate(`/returns/${createdReturn.id}`);
                  }}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-brand-dark text-white text-xs font-bold hover:bg-brand transition cursor-pointer"
                >
                  View Return Details
                </button>

                <Link
                  to="/returns"
                  onClick={onClose}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition text-center"
                >
                  All Returns
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* ── Action Buttons Footer ── */}
        {step < 4 && (
          <div className="p-4 sm:p-5 border-t border-slate-100 flex items-center justify-between gap-3 bg-white">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("light");
                  setStep((s) => (s - 1) as 1 | 2 | 3);
                }}
                disabled={submitting}
                className="inline-flex items-center space-x-1.5 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-500 font-bold text-xs hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
            )}

            {step === 1 && (
              <button
                type="button"
                onClick={handleNextToStep2}
                className="inline-flex items-center space-x-1.5 px-5 py-2.5 rounded-xl text-white font-bold text-xs bg-linear-to-b from-brand-light to-brand-dark shadow-sm hover:opacity-95 transition cursor-pointer"
              >
                <span>Continue ({selectedEntries.length} items)</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            {step === 2 && (
              <button
                type="button"
                onClick={handleNextToStep3}
                className="inline-flex items-center space-x-1.5 px-5 py-2.5 rounded-xl text-white font-bold text-xs bg-linear-to-b from-brand-light to-brand-dark shadow-sm hover:opacity-95 transition cursor-pointer"
              >
                <span>Add Evidence</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            {step === 3 && (
              <button
                type="button"
                onClick={handleSubmitReturn}
                disabled={submitting}
                className="inline-flex items-center space-x-1.5 px-6 py-2.5 rounded-xl text-white font-black text-xs bg-linear-to-b from-brand-light to-brand-dark shadow-sm hover:opacity-95 disabled:opacity-50 transition cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{uploadProgress || "Submitting..."}</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 stroke-3" />
                    <span>Submit Return Request</span>
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
