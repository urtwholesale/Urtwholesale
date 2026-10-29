import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router";
import { getReturnById, getReturnEvidenceUrl } from "../services/returnService";
import { useSettings } from "../context/SettingsContext";
import type { ReturnRequest, ReturnEvent, ReturnStatus } from "@urbanrat/shared";
import {
  RETURN_STATUS_LABELS,
  RETURN_REASON_LABELS,
} from "@urbanrat/shared";
import { triggerHaptic } from "../utils/haptics";
import {
  RotateCcw,
  Calendar,
  Copy,
  Check,
  ChevronRight,
  Package,
  Sparkles,
  FileText,
  Loader2,
  ExternalLink,
  MessageCircle,
  Clock,
  Truck,
  ShieldCheck,
  X,
} from "lucide-react";

export function ReturnDetailPage() {
  const { returnId } = useParams<{ returnId: string }>();
  const { whatsappNumber } = useSettings();

  const [returnReq, setReturnReq] = useState<ReturnRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Evidence signed URLs
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>([]);
  const [activeMediaUrl, setActiveMediaUrl] = useState<string | null>(null);

  // Copy Feedback
  const [copiedCode, setCopiedCode] = useState(false);

  const loadReturn = useCallback(async () => {
    if (!returnId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await getReturnById(returnId.trim());
      setReturnReq(data);

      // Load signed URLs for evidence files
      if (data && data.evidence_paths && data.evidence_paths.length > 0) {
        const urls = await Promise.all(
          data.evidence_paths.map((path) => getReturnEvidenceUrl(path))
        );
        setEvidenceUrls(urls.filter(Boolean));
      }
    } catch (err: unknown) {
      console.error("Failed to load return details:", err);
      const e = err as Error;
      setError(e.message || "Failed to retrieve return request details.");
    } finally {
      setLoading(false);
    }
  }, [returnId]);

  useEffect(() => {
    loadReturn();
  }, [loadReturn]);

  function handleCopyCode() {
    if (!returnReq) return;
    triggerHaptic("selection");
    navigator.clipboard.writeText(returnReq.return_code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  }

  if (loading) {
    return (
      <div className="py-24 text-center space-y-4 max-w-lg mx-auto">
        <Loader2 className="w-9 h-9 text-brand-dark animate-spin mx-auto" />
        <p className="text-sm font-bold text-slate-800">Loading Return Details...</p>
        <p className="text-xs text-slate-500">Retrieving wholesale warranty claim timeline</p>
      </div>
    );
  }

  if (error || !returnReq) {
    return (
      <div className="max-w-md mx-auto py-14 px-4 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-orange-500/15 text-amber-600 dark:text-orange-400 flex items-center justify-center mx-auto border border-amber-100 dark:border-orange-500/30">
          <RotateCcw className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-black text-slate-900 dark:text-white">Return Request Not Found</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          We couldn't locate return record #{returnId || "unknown"}. Please check your link or return history.
        </p>
        <Link
          to="/returns"
          style={{
            background: "var(--brand-gradient)",
            boxShadow: "var(--brand-shadow)",
          }}
          className="inline-block px-5 py-2.5 rounded-xl text-white font-bold text-xs transition hover:opacity-95"
        >
          View All Returns
        </Link>
      </div>
    );
  }

  // WhatsApp Support Link
  const targetWhatsApp = whatsappNumber || "919999999999";
  const whatsappUrl = `https://wa.me/${targetWhatsApp.replace(/\D/g, "")}?text=${encodeURIComponent(
    `Hello URT Wholesale Resolution Desk, I am inquiring about my Return Request #${returnReq.return_code} (Order #${returnReq.order_id}).`
  )}`;

  const formattedDate = new Date(returnReq.requested_at).toLocaleDateString(
    "en-IN",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  );

  // Status Styling Configuration
  function getStatusMeta(status: ReturnStatus) {
    switch (status) {
      case "requested":
        return {
          dot: "bg-amber-500",
          badge: "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/60",
        };
      case "approved":
        return {
          dot: "bg-blue-500",
          badge: "bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800/60",
        };
      case "pickup_scheduled":
      case "in_transit":
        return {
          dot: "bg-indigo-500",
          badge: "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/60",
        };
      case "received":
        return {
          dot: "bg-purple-500",
          badge: "bg-purple-50 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800/60",
        };
      case "qc_passed":
      case "refunded":
      case "replacement_shipped":
        return {
          dot: "bg-emerald-500",
          badge: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60",
        };
      case "rejected":
      case "qc_failed":
        return {
          dot: "bg-rose-500",
          badge: "bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800/60",
        };
      case "closed":
      default:
        return {
          dot: "bg-slate-400 dark:bg-slate-500",
          badge: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700",
        };
    }
  }

  const statusMeta = getStatusMeta(returnReq.status);

  return (
    <div className="max-w-5xl mx-auto py-4 sm:py-6 px-3 sm:px-4 space-y-5 animate-in fade-in duration-300 pb-20">
      {/* ── Breadcrumb Navigation ── */}
      <nav aria-label="Breadcrumb" className="flex items-center space-x-1.5 text-xs text-slate-500 dark:text-slate-400 overflow-x-auto py-1">
        <Link to="/" className="hover:text-slate-900 dark:hover:text-white transition shrink-0">
          Home
        </Link>
        <ChevronRight className="w-3 h-3 text-slate-300 dark:text-slate-600 shrink-0" />
        <Link to="/account" className="hover:text-slate-900 dark:hover:text-white transition shrink-0">
          My Account
        </Link>
        <ChevronRight className="w-3 h-3 text-slate-300 dark:text-slate-600 shrink-0" />
        <Link to="/returns" className="hover:text-slate-900 dark:hover:text-white transition shrink-0">
          Returns
        </Link>
        <ChevronRight className="w-3 h-3 text-slate-300 dark:text-slate-600 shrink-0" />
        <span className="font-bold text-slate-900 dark:text-white truncate shrink-0">
          {returnReq.return_code}
        </span>
      </nav>

      {/* ── Top Header Banner ── */}
      <div className="bg-white dark:bg-slate-900/90 rounded-3xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3 flex-wrap gap-y-1">
            <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center space-x-2">
              <span>{returnReq.return_code}</span>
              <button
                type="button"
                onClick={handleCopyCode}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition cursor-pointer"
                title="Copy Return Code"
              >
                {copiedCode ? (
                  <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </h1>

            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              {returnReq.type === "replacement" ? (
                <Sparkles className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
              ) : (
                <RotateCcw className="w-3.5 h-3.5 text-amber-600 dark:text-orange-400" />
              )}
              <span>{returnReq.type}</span>
            </span>

            <span
              className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold border ${statusMeta.badge}`}
            >
              <span className={`w-2 h-2 rounded-full ${statusMeta.dot}`} />
              <span>{RETURN_STATUS_LABELS[returnReq.status]}</span>
            </span>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center space-x-2 flex-wrap">
            <span className="flex items-center space-x-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
              <span>Requested on {formattedDate}</span>
            </span>
            <span className="text-slate-300 dark:text-slate-600">&bull;</span>
            <span>
              Order:{" "}
              <Link
                to={`/order/${returnReq.order_id}`}
                className="font-bold text-brand-dark dark:text-orange-400 hover:underline"
              >
                #{returnReq.order_id}
              </Link>
            </span>
          </p>
        </div>

        {/* WhatsApp Deep Link Button */}
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 font-bold text-xs border border-emerald-200/80 dark:border-emerald-800/60 transition shadow-2xs self-start md:self-auto"
        >
          <MessageCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>Resolution Desk on WhatsApp</span>
        </a>
      </div>

      {/* ── Two Column Content Layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* ── Left Column: Timeline, Items & Evidence ── */}
        <div className="lg:col-span-8 space-y-5">
          {/* ── Vertical Timeline from return_events ── */}
          <div className="bg-white dark:bg-slate-900/90 rounded-3xl border border-slate-200/90 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-4">
            <h2 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center space-x-2">
              <Clock className="w-4 h-4 text-brand-dark dark:text-orange-400" />
              <span>Return Status Timeline</span>
            </h2>

            {returnReq.events && returnReq.events.length > 0 ? (
              <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:left-2.75 sm:before:left-3.75 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-700">
                {returnReq.events.map((ev: ReturnEvent, idx: number) => {
                  const evDate = new Date(ev.created_at).toLocaleString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  const isLast = idx === returnReq.events!.length - 1;

                  return (
                    <div key={ev.id || idx} className="relative flex items-start space-x-3">
                      {/* Connected Dot */}
                      <div
                        className={`absolute -left-6 sm:-left-8 top-0.5 w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                          isLast
                            ? "bg-brand-dark dark:bg-orange-500 text-white ring-4 ring-sky-100 dark:ring-orange-500/20"
                            : "bg-emerald-600 text-white shadow-xs"
                        }`}
                      >
                        {isLast ? (
                          <span className="w-2 h-2 rounded-full bg-white" />
                        ) : (
                          <Check className="w-3.5 h-3.5 stroke-3" />
                        )}
                      </div>

                      {/* Event Content */}
                      <div className="min-w-0 flex-1 pt-0.5">
                        <div className="flex items-baseline justify-between flex-wrap gap-x-2">
                          <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white capitalize">
                            {RETURN_STATUS_LABELS[ev.status as ReturnStatus] || ev.status}
                          </p>
                          <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                            {evDate}
                          </span>
                        </div>

                        {ev.note && (
                          <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-750 leading-relaxed">
                            {ev.note}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400 italic">No timeline events recorded.</p>
            )}
          </div>

          {/* ── Returned Items List ── */}
          <div className="bg-white dark:bg-slate-900/90 rounded-3xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-xs space-y-4">
            <h2 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center space-x-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <Package className="w-4 h-4 text-brand-dark dark:text-orange-400" />
              <span>Returned Items ({returnReq.items?.length || 0})</span>
            </h2>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {returnReq.items?.map((item, idx) => {
                const prod = item.product;
                const unitPrice = prod?.price || 0;

                return (
                  <div
                    key={item.id || idx}
                    className="py-3 flex items-start justify-between gap-3"
                  >
                    <div className="flex items-start space-x-3 min-w-0">
                      <div className="w-14 h-14 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-750 flex items-center justify-center overflow-hidden shrink-0">
                        {prod?.images?.[0] ? (
                          <img
                            src={prod.images[0]}
                            alt={prod.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Package className="w-6 h-6 text-slate-300 dark:text-slate-600" />
                        )}
                      </div>

                      <div className="min-w-0 space-y-0.5">
                        <p className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white leading-snug">
                          {prod?.name || "Product Unit"}
                        </p>
                        <div className="flex items-center space-x-2 text-[11px] text-slate-500 dark:text-slate-400">
                          {prod?.sku && <span>SKU: {prod.sku}</span>}
                          <span>&bull;</span>
                          <span>Condition: <strong className="capitalize text-slate-700 dark:text-slate-200">{item.condition || "Unopened"}</strong></span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 font-semibold pt-0.5">
                          Quantity: <strong className="text-slate-900 dark:text-white">{item.quantity} pcs</strong>
                          {unitPrice > 0 && ` × ₹${unitPrice.toLocaleString("en-IN")}`}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Reason, Description & Evidence Thumbnails ── */}
          <div className="bg-white dark:bg-slate-900/90 rounded-3xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-xs space-y-4">
            <h2 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center space-x-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <FileText className="w-4 h-4 text-brand-dark dark:text-orange-400" />
              <span>Reason &amp; Uploaded Evidence</span>
            </h2>

            <div className="space-y-3 text-xs text-slate-700 dark:text-slate-300">
              <div>
                <span className="font-bold text-slate-500 dark:text-slate-400 text-[11px] uppercase tracking-wider block">
                  Reported Reason
                </span>
                <p className="font-bold text-slate-900 dark:text-white text-sm mt-0.5">
                  {RETURN_REASON_LABELS[returnReq.reason_code]}
                </p>
              </div>

              {returnReq.description && (
                <div>
                  <span className="font-bold text-slate-500 dark:text-slate-400 text-[11px] uppercase tracking-wider block">
                    Customer Description
                  </span>
                  <p className="mt-1 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-750 leading-relaxed text-slate-800 dark:text-slate-200">
                    {returnReq.description}
                  </p>
                </div>
              )}

              {/* Evidence Thumbnails */}
              {evidenceUrls.length > 0 && (
                <div className="pt-2">
                  <span className="font-bold text-slate-500 dark:text-slate-400 text-[11px] uppercase tracking-wider block mb-2">
                    Evidence Media ({evidenceUrls.length})
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {evidenceUrls.map((url, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setActiveMediaUrl(url)}
                        className="group relative h-24 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 overflow-hidden cursor-pointer hover:border-brand-dark dark:hover:border-orange-500 transition-all"
                      >
                        <img
                          src={url}
                          alt={`evidence-${i + 1}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                          <ExternalLink className="w-4 h-4" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Right Column: Resolution & Admin Message ── */}
        <div className="lg:col-span-4 space-y-4 lg:sticky lg:top-6">
          {/* Resolution Card */}
          <div className="bg-white dark:bg-slate-900/90 rounded-3xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-xs space-y-3.5">
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
              Resolution Summary
            </h3>

            <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex justify-between">
                <span>Resolution Type:</span>
                <span className="font-bold uppercase text-slate-900 dark:text-white">
                  {returnReq.type}
                </span>
              </div>

              {returnReq.refund_amount > 0 && (
                <div className="flex justify-between items-baseline text-emerald-700 dark:text-emerald-400 font-bold">
                  <span>Refund / Credit Value:</span>
                  <span className="text-base font-black">
                    ₹{returnReq.refund_amount.toLocaleString("en-IN")}
                  </span>
                </div>
              )}

              {returnReq.resolved_at && (
                <div className="flex justify-between text-slate-500 dark:text-slate-400 text-[11px]">
                  <span>Resolved On:</span>
                  <span>
                    {new Date(returnReq.resolved_at).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>
              )}
            </div>

            {/* Admin Note when present */}
            {returnReq.admin_note ? (
              <div className="p-3 bg-amber-50/70 dark:bg-amber-950/30 rounded-2xl border border-amber-200/70 dark:border-amber-800/50 text-xs space-y-1">
                <span className="font-bold text-amber-900 dark:text-amber-300 flex items-center space-x-1.5">
                  <ShieldCheck className="w-4 h-4 text-amber-700 dark:text-amber-400" />
                  <span>QC &amp; Operational Note:</span>
                </span>
                <p className="text-amber-800 dark:text-amber-200 leading-relaxed">
                  {returnReq.admin_note}
                </p>
              </div>
            ) : (
              <p className="text-[11px] text-slate-400 dark:text-slate-500 italic">
                Our warehouse QC inspection team is currently verifying the consignment.
              </p>
            )}
          </div>

          {/* Quick Help Box */}
          <div className="bg-slate-50/80 dark:bg-slate-800/60 rounded-3xl border border-slate-200/70 dark:border-slate-700/80 p-4 space-y-2 text-xs text-slate-600 dark:text-slate-300">
            <div className="flex items-center space-x-2 text-slate-900 dark:text-white font-bold">
              <Truck className="w-4 h-4 text-brand-dark dark:text-orange-400" />
              <span>Doorstep Pickup Assistance</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Keep the items packed securely in their original carton box. The courier pickup agent will contact you prior to arrival.
            </p>
            <div className="pt-1">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-dark dark:text-orange-400 font-bold hover:underline inline-flex items-center space-x-1 text-xs"
              >
                <span>Chat with Resolution Support</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* ── Media Lightbox Modal ── */}
      {activeMediaUrl && (
        <div
          onClick={() => setActiveMediaUrl(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in"
        >
          <div className="relative max-w-3xl max-h-[90vh] bg-transparent">
            <button
              type="button"
              onClick={() => setActiveMediaUrl(null)}
              className="absolute -top-10 right-0 w-8 h-8 rounded-full bg-white/20 text-white hover:bg-white/40 flex items-center justify-center cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={activeMediaUrl}
              alt="enlarged-evidence"
              className="max-h-[85vh] max-w-full rounded-2xl object-contain shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}
