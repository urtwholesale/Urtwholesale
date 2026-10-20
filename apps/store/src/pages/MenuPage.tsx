import { useState, useEffect, useCallback } from "react";
import { CustomerAuth } from "../features/auth/CustomerAuth";
import {
  fetchCustomerOrders,
  fetchAllStorePages,
} from "../services/storeService";
import { useSettings } from "../context/SettingsContext";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import type { Order, StorePage } from "@urbanrat/shared";
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
  const { settings, whatsappNumber } = useSettings();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  const [pages, setPages] = useState<Record<string, StorePage>>({});
  const [loadingPages, setLoadingPages] = useState(true);
  const [pagesError, setPagesError] = useState<string | null>(null);

  // Accordion toggles
  const [openAbout, setOpenAbout] = useState(false);
  const [openTerms, setOpenTerms] = useState(false);
  const [openPrivacy, setOpenPrivacy] = useState(false);

  const loadOrders = useCallback(async () => {
    setLoadingOrders(true);
    setOrdersError(null);
    try {
      const data = await fetchCustomerOrders();
      setOrders(data);
    } catch (err: any) {
      console.error("Failed to load customer orders:", err);
      setOrdersError(err?.message || "Failed to load orders. Please retry.");
    } finally {
      setLoadingOrders(false);
    }
  }, []);

  const loadPages = useCallback(async () => {
    setLoadingPages(true);
    setPagesError(null);
    try {
      const storePages = await fetchAllStorePages();
      const pageMap: Record<string, StorePage> = {};
      for (const p of storePages) {
        pageMap[p.slug] = p;
      }
      setPages(pageMap);
    } catch (err: any) {
      console.error("Failed to load store pages:", err);
      setPagesError(err?.message || "Failed to load policy pages.");
    } finally {
      setLoadingPages(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
    loadPages();
  }, [loadOrders, loadPages]);

  const aboutPage = pages["about"];
  const termsPage = pages["terms"];
  const privacyPage = pages["privacy"];

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
                <div className="w-8 h-8 rounded-xl bg-sky-50 text-brand-dark flex items-center justify-center">
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
              <div className="py-4 space-y-2.5">
                <div className="h-16 bg-slate-50 rounded-2xl animate-pulse" />
                <div className="h-16 bg-slate-50 rounded-2xl animate-pulse" />
              </div>
            ) : ordersError ? (
              <ErrorState
                title="Could not load your orders"
                message={ordersError}
                onRetry={loadOrders}
              />
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
                          #{ord.id.slice(0, 14)}
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

                      {whatsappNumber && (
                        <a
                          href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
                            `Hi URT Wholesale, checking status for Order #${ord.id}`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-brand-dark font-bold hover:underline"
                        >
                          Track on WhatsApp →
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<Package className="w-7 h-7 text-slate-400" />}
                title="No orders placed yet"
                description="Your past wholesale orders and tracking info will be visible here once you checkout."
              />
            )}
          </section>
        </div>

        {/* ── Right Column: Helpdesk & Policies ── */}
        <div className="lg:col-span-5 xl:col-span-5 space-y-6 lg:sticky lg:top-24">
          {/* ── 3. Contact on WhatsApp (Only shown if whatsappNumber is configured) ── */}
          {whatsappNumber && (
            <section className="overflow-hidden rounded-3xl bg-linear-to-br from-emerald-600 to-teal-700 text-white p-5 sm:p-6 shadow-md">
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
                  href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
                    "Hi URT Wholesale, I need assistance with wholesale orders"
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-white text-emerald-800 font-bold text-xs shadow hover:bg-emerald-50 active:scale-95 transition"
                >
                  <span>Chat on WhatsApp</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </section>
          )}

          {/* ── 4. About Us, Terms & Privacy Accordions from Database store_pages ── */}
          <section className="bg-white rounded-3xl border border-slate-100 p-2 sm:p-3 shadow-xs space-y-1">
            {loadingPages ? (
              <div className="p-4 space-y-3">
                <div className="h-10 bg-slate-50 rounded-xl animate-pulse" />
                <div className="h-10 bg-slate-50 rounded-xl animate-pulse" />
                <div className="h-10 bg-slate-50 rounded-xl animate-pulse" />
              </div>
            ) : pagesError ? (
              <ErrorState
                title="Could not load policies"
                message={pagesError}
                onRetry={loadPages}
              />
            ) : (
              <>
                {/* About Us */}
                {aboutPage && (
                  <div className="rounded-2xl overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setOpenAbout(!openAbout)}
                      className="w-full flex items-center justify-between p-3.5 hover:bg-slate-50 transition text-left cursor-pointer"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-xl bg-cyan-50 text-brand-dark flex items-center justify-center">
                          <Info className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-800">
                            {aboutPage.title}
                          </p>
                          {aboutPage.summary && (
                            <p className="text-[10px] text-slate-400">
                              {aboutPage.summary}
                            </p>
                          )}
                        </div>
                      </div>
                      <ChevronDown
                        className={`w-4 h-4 text-slate-400 transition-transform ${
                          openAbout ? "rotate-180 text-brand-dark" : ""
                        }`}
                      />
                    </button>

                    {openAbout && (
                      <div className="px-4 pb-4 pt-1 text-xs text-slate-600 space-y-2 border-t border-slate-50 whitespace-pre-line leading-relaxed font-normal">
                        {aboutPage.content}
                      </div>
                    )}
                  </div>
                )}

                {/* Terms of Service */}
                {termsPage && (
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
                            {termsPage.title}
                          </p>
                          {termsPage.summary && (
                            <p className="text-[10px] text-slate-400">
                              {termsPage.summary}
                            </p>
                          )}
                        </div>
                      </div>
                      <ChevronDown
                        className={`w-4 h-4 text-slate-400 transition-transform ${
                          openTerms ? "rotate-180 text-purple-600" : ""
                        }`}
                      />
                    </button>

                    {openTerms && (
                      <div className="px-4 pb-4 pt-1 text-xs text-slate-600 space-y-2 border-t border-slate-50 whitespace-pre-line leading-relaxed font-normal">
                        {termsPage.content}
                      </div>
                    )}
                  </div>
                )}

                {/* Privacy Policy */}
                {privacyPage && (
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
                            {privacyPage.title}
                          </p>
                          {privacyPage.summary && (
                            <p className="text-[10px] text-slate-400">
                              {privacyPage.summary}
                            </p>
                          )}
                        </div>
                      </div>
                      <ChevronDown
                        className={`w-4 h-4 text-slate-400 transition-transform ${
                          openPrivacy ? "rotate-180 text-amber-600" : ""
                        }`}
                      />
                    </button>

                    {openPrivacy && (
                      <div className="px-4 pb-4 pt-1 text-xs text-slate-600 space-y-2 border-t border-slate-50 whitespace-pre-line leading-relaxed font-normal">
                        {privacyPage.content}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </div>

      {/* ── Wholesale Footer Credit ── */}
      <footer className="text-center text-[11px] text-slate-400 py-4 space-y-1 flex flex-col items-center">
        <img
          src="/logo.png"
          alt="Urbanrat"
          className="w-8 h-8 rounded-full object-cover opacity-80"
        />
        <p className="font-semibold text-slate-600">
          {settings?.store_info?.name || "URT Wholesale"}
        </p>
        <p>Supplied by Urbanrat Wholesale • Pan-India Logistics</p>
      </footer>
    </div>
  );
}
