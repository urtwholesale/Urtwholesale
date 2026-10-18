import { useState, useEffect } from "react";
import { CustomerAuth } from "../features/auth/CustomerAuth";
import { fetchCustomerOrders } from "../services/storeService";
import type { Order } from "@urbanrat/shared";
import {
  Package,
  MessageCircle,
  Shield,
  ExternalLink,
  ChevronDown,
  Info,
  FileText,
  Clock,
  Phone,
} from "lucide-react";

export function MenuPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);

  // Accordion toggles
  const [openAbout, setOpenAbout] = useState(false);
  const [openTerms, setOpenTerms] = useState(false);
  const [openPrivacy, setOpenPrivacy] = useState(false);

  useEffect(() => {
    async function loadOrders() {
      try {
        const data = await fetchCustomerOrders();
        setOrders(data);
      } catch (err) {
        console.error("Failed to load orders:", err);
      } finally {
        setLoadingOrders(false);
      }
    }
    loadOrders();
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-16">
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
          Account &amp; Menu
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Profile, order status, WhatsApp support, and wholesale policies
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ── Left Column: Profile & Orders ── */}
        <div className="lg:col-span-7 xl:col-span-7 space-y-6">
          {/* ── 1. Login / Customer Profile ── */}
          <section>
            <CustomerAuth />
          </section>

          {/* ── 2. My Orders ── */}
          <section className="bg-white rounded-3xl border border-slate-100 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-sky-50 text-[#0A82A8] flex items-center justify-center">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-extrabold text-slate-800">
                    My Orders
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Track recent orders &amp; wholesale dispatches
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold text-slate-500">
                {orders.length} {orders.length === 1 ? "order" : "orders"}
              </span>
            </div>

            {loadingOrders ? (
              <div className="py-4 space-y-2">
                <div className="h-14 bg-slate-50 rounded-2xl animate-pulse" />
              </div>
            ) : orders.length > 0 ? (
              <div className="space-y-2.5 pt-1">
                {orders.map((ord) => (
                  <div
                    key={ord.id}
                    className="p-3.5 rounded-2xl bg-slate-50/70 border border-slate-100 hover:bg-slate-50 transition space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-xs font-bold text-slate-900">
                          #{ord.id.slice(0, 12)}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            ord.status === "delivered"
                              ? "bg-emerald-100 text-emerald-800"
                              : ord.status === "cancelled"
                              ? "bg-rose-100 text-rose-800"
                              : "bg-sky-100 text-sky-800"
                          }`}
                        >
                          {ord.status}
                        </span>
                      </div>

                      <span className="text-xs font-black text-slate-900">
                        ₹{ord.total.toLocaleString("en-IN")}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/50">
                      <span className="flex items-center space-x-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{new Date(ord.created_at).toLocaleDateString()}</span>
                      </span>

                      <a
                        href={`https://wa.me/917000947033?text=${encodeURIComponent(
                          `Hi URT Wholesale, checking status for Order #${ord.id}`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#0A82A8] font-bold hover:underline"
                      >
                        Track on WhatsApp →
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 py-3 text-center">
                No orders placed yet. Add items to your cart to get started!
              </p>
            )}
          </section>
        </div>

        {/* ── Right Column: Helpdesk & Policies ── */}
        <div className="lg:col-span-5 xl:col-span-5 space-y-6 lg:sticky lg:top-24">
          {/* ── 3. Contact on WhatsApp ── */}
          <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white p-5 sm:p-6 shadow-md">
            <div className="flex items-start justify-between">
              <div className="space-y-1 max-w-sm">
                <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/20 text-white">
                  <Phone className="w-3 h-3" />
                  <span>Priority Helpdesk</span>
                </div>
                <h3 className="text-base sm:text-lg font-black text-white">
                  Direct WhatsApp Support
                </h3>
                <p className="text-xs text-emerald-100 leading-relaxed">
                  Instant responses from our wholesale fulfillment desk for custom orders, bulk quotes, and dispatch inquiries.
                </p>
              </div>

              <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-xs flex items-center justify-center shrink-0">
                <MessageCircle className="w-7 h-7 text-white" />
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-emerald-500/40 flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-100">
                Available Mon–Sat: 9 AM – 8 PM
              </span>
              <a
                href="https://wa.me/917000947033?text=Hi%20URT%20Wholesale%2C%20I%20need%20assistance%20with%20wholesale%20orders"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-white text-emerald-800 font-bold text-xs shadow hover:bg-emerald-50 active:scale-95 transition"
              >
                <span>Chat on WhatsApp</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </section>

          {/* ── 4. About Us, Terms & Privacy Accordions ── */}
          <section className="bg-white rounded-3xl border border-slate-100 p-2 sm:p-3 shadow-xs space-y-1">
        {/* About Us */}
        <div className="rounded-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => setOpenAbout(!openAbout)}
            className="w-full flex items-center justify-between p-3.5 hover:bg-slate-50 transition text-left cursor-pointer"
          >
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-xl bg-cyan-50 text-[#0A82A8] flex items-center justify-center">
                <Info className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800">About Urbanrat</p>
                <p className="text-[10px] text-slate-400">
                  Our factory-direct wholesale story &amp; quality pledge
                </p>
              </div>
            </div>
            <ChevronDown
              className={`w-4 h-4 text-slate-400 transition-transform ${
                openAbout ? "rotate-180 text-[#0A82A8]" : ""
              }`}
            />
          </button>

          {openAbout && (
            <div className="px-4 pb-4 pt-1 text-xs text-slate-600 space-y-2 border-t border-slate-50">
              <p>
                Urbanrat is a single-vendor specialized supplier of high-grade mobile accessories and digital electronics, supplied by <strong>URP Wholesale</strong>.
              </p>
              <p>
                We bypass distributor markups and intermediate traders to provide retailers, corporate buyers, and tech enthusiasts direct access to precision 9H sapphire tempered glass, GaN power bricks, ballistic braided cables, and audio hardware.
              </p>
            </div>
          )}
        </div>

        {/* Terms of Service */}
        <div className="rounded-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => setOpenTerms(!openTerms)}
            className="w-full flex items-center justify-between p-3.5 hover:bg-slate-50 transition text-left cursor-pointer"
          >
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800">
                  Terms of Service &amp; Warranty
                </p>
                <p className="text-[10px] text-slate-400">
                  Dead-on-arrival replacements and invoice policy
                </p>
              </div>
            </div>
            <ChevronDown
              className={`w-4 h-4 text-slate-400 transition-transform ${
                openTerms ? "rotate-180 text-purple-600" : ""
              }`}
            />
          </button>

          {openTerms && (
            <div className="px-4 pb-4 pt-1 text-xs text-slate-600 space-y-2 border-t border-slate-50">
              <p>
                <strong>1. Quality Guarantee:</strong> Every unit undergoes standard electrical and drop QC checks before boxing.
              </p>
              <p>
                <strong>2. Transit Replacements:</strong> Any parcel reported broken or dead-on-arrival within 48 hours of courier delivery is eligible for immediate 1-to-1 swap.
              </p>
              <p>
                <strong>3. Wholesale Payments:</strong> Invoices are generated electronically with full GST breakdown upon order placement.
              </p>
            </div>
          )}
        </div>

        {/* Privacy Policy */}
        <div className="rounded-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => setOpenPrivacy(!openPrivacy)}
            className="w-full flex items-center justify-between p-3.5 hover:bg-slate-50 transition text-left cursor-pointer"
          >
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Shield className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800">
                  Privacy Policy &amp; Security
                </p>
                <p className="text-[10px] text-slate-400">
                  Encrypted authentication and zero data trading
                </p>
              </div>
            </div>
            <ChevronDown
              className={`w-4 h-4 text-slate-400 transition-transform ${
                openPrivacy ? "rotate-180 text-amber-600" : ""
              }`}
            />
          </button>

          {openPrivacy && (
            <div className="px-4 pb-4 pt-1 text-xs text-slate-600 space-y-2 border-t border-slate-50">
              <p>
                Your phone numbers, delivery coordinates, and purchase records are secured with row-level security through Supabase and never shared with third-party advertisers.
              </p>
              <p>
                WhatsApp interactions are end-to-end encrypted under Meta's security architecture.
              </p>
            </div>
          )}
        </div>
      </section>
        </div>
      </div>

      {/* ── Wholesale Footer Credit ── */}
      <footer className="text-center text-[11px] text-slate-400 py-2 space-y-0.5">
        <p className="font-semibold text-slate-500">Urbanrat Store v1.0.0</p>
        <p>Supplied by URP Wholesale • Pan-India Logistics</p>
      </footer>
    </div>
  );
}
