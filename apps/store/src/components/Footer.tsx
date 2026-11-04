import { Link } from "react-router";
import { useSettings } from "../context/SettingsContext";
import { useLanguage } from "../context/LanguageContext";
import { triggerHaptic } from "../utils/haptics";
import {
  ShieldCheck,
  Truck,
  Receipt,
  MessageCircle,
  ExternalLink,
  ChevronRight,
  Clock,
  Zap,
  Package,
  MapPin,
  CheckCircle2,
  Lock,
  Languages,
} from "lucide-react";

export function Footer() {
  const { settings, whatsappNumber } = useSettings();
  const { isHindi, setLanguage, t } = useLanguage();
  const currentYear = new Date().getFullYear();

  const storeName =
    settings?.store_name?.trim() ||
    settings?.store_info?.name?.trim() ||
    "URT Wholesale";

  const whatsappHref = whatsappNumber
    ? `https://wa.me/${whatsappNumber.replace(/\D/g, "")}?text=${encodeURIComponent(
        isHindi
          ? "नमस्ते URT Wholesale सपोर्ट, मुझे थोक खरीद के बारे में जानकारी चाहिए।"
          : "Hello URT Wholesale Support, I have a wholesale inquiry."
      )}`
    : null;

  return (
    <footer
      aria-label="Site Footer"
      className="w-full bg-slate-900 dark:bg-slate-950 text-slate-300 border-t border-slate-800 pt-12 pb-28 md:pb-12 mt-auto transition-colors select-none"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* ── 1. Top Wholesale Value Pillars (Trust Ribbon) ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 pb-10 border-b border-slate-800">
          {/* Pillar 1 */}
          <div className="flex items-start space-x-3.5 p-4 rounded-2xl bg-slate-800/60 dark:bg-slate-900/60 border border-slate-700/60 backdrop-blur-xs">
            <div className="p-2.5 rounded-xl bg-cyan-500/15 dark:bg-orange-500/15 text-brand-light shrink-0">
              <Zap className="w-5 h-5 text-cyan-400 dark:text-orange-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">
                {t("footer.factory_rates", "Factory-Direct Rates")}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                {t("footer.factory_rates_desc", "Zero distributor markups. Maximum retail profit margins for your shop.")}
              </p>
            </div>
          </div>

          {/* Pillar 2 */}
          <div className="flex items-start space-x-3.5 p-4 rounded-2xl bg-slate-800/60 dark:bg-slate-900/60 border border-slate-700/60 backdrop-blur-xs">
            <div className="p-2.5 rounded-xl bg-cyan-500/15 dark:bg-orange-500/15 text-brand-light shrink-0">
              <ShieldCheck className="w-5 h-5 text-cyan-400 dark:text-orange-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">
                {t("footer.quality_inspected", "100% Quality Inspected")}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                {t("footer.quality_desc", "Dual bench testing on voltage, thermals & fitment before packaging.")}
              </p>
            </div>
          </div>

          {/* Pillar 3 */}
          <div className="flex items-start space-x-3.5 p-4 rounded-2xl bg-slate-800/60 dark:bg-slate-900/60 border border-slate-700/60 backdrop-blur-xs">
            <div className="p-2.5 rounded-xl bg-cyan-500/15 dark:bg-orange-500/15 text-brand-light shrink-0">
              <Truck className="w-5 h-5 text-cyan-400 dark:text-orange-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">
                {t("footer.express_dispatch", "Pan-India Express Dispatch")}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                {t("footer.express_desc", "Surface & air cargo via SafeXpress & Delhivery with live tracking.")}
              </p>
            </div>
          </div>

          {/* Pillar 4 */}
          <div className="flex items-start space-x-3.5 p-4 rounded-2xl bg-slate-800/60 dark:bg-slate-900/60 border border-slate-700/60 backdrop-blur-xs">
            <div className="p-2.5 rounded-xl bg-cyan-500/15 dark:bg-orange-500/15 text-brand-light shrink-0">
              <Receipt className="w-5 h-5 text-cyan-400 dark:text-orange-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">
                {t("footer.gst_billing", "GST Tax Invoicing & ITC")}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                {t("footer.gst_desc", "100% legal business billing. Claim back Input Tax Credit on every order.")}
              </p>
            </div>
          </div>
        </div>

        {/* ── 2. Main 4-Column Navigation & Info Grid ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-10">
          {/* Column 1: Brand & Wholesale Identity (2 cols on large screen) */}
          <div className="lg:col-span-2 space-y-4">
            <Link
              to="/"
              onClick={() => triggerHaptic("light")}
              className="inline-flex items-center space-x-3 group"
            >
              <img
                src="/logo.png"
                alt="URT Logo"
                className="w-9 h-9 rounded-xl object-cover ring-2 ring-white/10 group-hover:scale-105 transition"
              />
              <div>
                <span className="text-lg font-black tracking-wider text-white">
                  URT WHOLESALE
                </span>
                <span className="block text-[10px] font-semibold text-cyan-400 dark:text-orange-400 uppercase tracking-widest">
                  Direct Factory Depot
                </span>
              </div>
            </Link>

            <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
              {t("footer.brand_desc", "India's high-velocity B2B wholesale platform for mobile accessories. Supplying smartphone shops and retail counters with genuine factory pricing, low MOQs, and reliable warranties.")}
            </p>

            {/* Direct WhatsApp Wholesale Desk Card */}
            {whatsappHref && (
              <div className="pt-2">
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => triggerHaptic("medium")}
                  className="inline-flex items-center space-x-2.5 px-4 py-2.5 rounded-xl bg-emerald-600/90 hover:bg-emerald-500 text-white text-xs font-bold shadow-md hover:shadow-emerald-600/30 active:scale-95 transition"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>{t("footer.whatsapp_desk", "Wholesale Desk: Chat on WhatsApp")}</span>
                  <ExternalLink className="w-3 h-3 opacity-80" />
                </a>
                <div className="flex items-center space-x-2 mt-2 text-[11px] text-slate-400">
                  <Clock className="w-3 h-3 text-emerald-400" />
                  <span>{t("footer.whatsapp_timing", "Mon – Sat: 10:00 AM – 8:00 PM IST (Avg reply: ~15 mins)")}</span>
                </div>
              </div>
            )}

            {/* Central Depot Location */}
            <div className="flex items-center space-x-2 text-[11px] text-slate-400">
              <MapPin className="w-3.5 h-3.5 text-cyan-400 dark:text-orange-400 shrink-0" />
              <span>{t("footer.hub_location", "Central Supply & Logistics Hub, India")}</span>
            </div>
          </div>

          {/* Column 2: Wholesale Catalog */}
          <div className="space-y-3.5">
            <h4 className="text-xs font-black uppercase tracking-wider text-white flex items-center space-x-2">
              <Package className="w-3.5 h-3.5 text-cyan-400 dark:text-orange-400" />
              <span>{t("footer.catalog_title", "Wholesale Catalog")}</span>
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link
                  to="/marketplace"
                  onClick={() => triggerHaptic("selection")}
                  className="hover:text-white transition flex items-center group"
                >
                  <ChevronRight className="w-3 h-3 mr-1 text-slate-600 group-hover:text-cyan-400 transition" />
                  {t("footer.all_products", "All Products")}
                </Link>
              </li>
              <li>
                <Link
                  to="/urbanrat"
                  onClick={() => triggerHaptic("selection")}
                  className="hover:text-white transition flex items-center group font-semibold text-cyan-300 dark:text-orange-300"
                >
                  <ChevronRight className="w-3 h-3 mr-1 text-slate-600 group-hover:text-cyan-400 transition" />
                  {t("footer.urt_branded", "URT Branded Gear")}
                  <span className="ml-1.5 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-cyan-500/20 text-cyan-300 dark:bg-orange-500/20 dark:text-orange-300">
                    Original
                  </span>
                </Link>
              </li>
              <li>
                <Link
                  to="/categories"
                  onClick={() => triggerHaptic("selection")}
                  className="hover:text-white transition flex items-center group"
                >
                  <ChevronRight className="w-3 h-3 mr-1 text-slate-600 group-hover:text-cyan-400 transition" />
                  {t("nav.categories", "All Categories")}
                </Link>
              </li>
              <li>
                <Link
                  to="/marketplace?category=chargers"
                  onClick={() => triggerHaptic("selection")}
                  className="hover:text-white transition flex items-center group"
                >
                  <ChevronRight className="w-3 h-3 mr-1 text-slate-600 group-hover:text-cyan-400 transition" />
                  {t("footer.chargers", "Fast Chargers & GaN")}
                </Link>
              </li>
              <li>
                <Link
                  to="/marketplace?category=cables"
                  onClick={() => triggerHaptic("selection")}
                  className="hover:text-white transition flex items-center group"
                >
                  <ChevronRight className="w-3 h-3 mr-1 text-slate-600 group-hover:text-cyan-400 transition" />
                  {t("footer.cables", "Braided Data Cables")}
                </Link>
              </li>
              <li>
                <Link
                  to="/marketplace?category=audio"
                  onClick={() => triggerHaptic("selection")}
                  className="hover:text-white transition flex items-center group"
                >
                  <ChevronRight className="w-3 h-3 mr-1 text-slate-600 group-hover:text-cyan-400 transition" />
                  {t("footer.audio", "Audio & TWS Earbuds")}
                </Link>
              </li>
              <li>
                <Link
                  to="/marketplace?sort=newest"
                  onClick={() => triggerHaptic("selection")}
                  className="hover:text-white transition flex items-center group"
                >
                  <ChevronRight className="w-3 h-3 mr-1 text-slate-600 group-hover:text-cyan-400 transition" />
                  {t("footer.new_drops", "New Factory Arrivals")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Dealership & B2B Solutions */}
          <div className="space-y-3.5">
            <h4 className="text-xs font-black uppercase tracking-wider text-white flex items-center space-x-2">
              <Zap className="w-3.5 h-3.5 text-cyan-400 dark:text-orange-400" />
              <span>{t("footer.dealership_title", "Dealership & B2B")}</span>
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link
                  to="/dealership"
                  onClick={() => triggerHaptic("selection")}
                  className="hover:text-white transition flex items-center group font-semibold text-emerald-400"
                >
                  <ChevronRight className="w-3 h-3 mr-1 text-slate-600 group-hover:text-emerald-400 transition" />
                  {t("footer.dealership_program", "Dealership Program")}
                  <span className="ml-1.5 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-emerald-500/20 text-emerald-300">
                    High Margin
                  </span>
                </Link>
              </li>
              <li>
                <Link
                  to="/dealers"
                  onClick={() => triggerHaptic("selection")}
                  className="hover:text-white transition flex items-center group"
                >
                  <ChevronRight className="w-3 h-3 mr-1 text-slate-600 group-hover:text-cyan-400 transition" />
                  {t("footer.apply_dealership", "Apply for Dealership")}
                </Link>
              </li>
              <li>
                <Link
                  to="/orders"
                  onClick={() => triggerHaptic("selection")}
                  className="hover:text-white transition flex items-center group"
                >
                  <ChevronRight className="w-3 h-3 mr-1 text-slate-600 group-hover:text-cyan-400 transition" />
                  {t("footer.track_order", "Track Wholesale Order")}
                </Link>
              </li>
              <li>
                <Link
                  to="/returns"
                  onClick={() => triggerHaptic("selection")}
                  className="hover:text-white transition flex items-center group"
                >
                  <ChevronRight className="w-3 h-3 mr-1 text-slate-600 group-hover:text-cyan-400 transition" />
                  {t("footer.returns_claims", "Returns & Claims")}
                </Link>
              </li>
              <li>
                <Link
                  to="/account"
                  onClick={() => triggerHaptic("selection")}
                  className="hover:text-white transition flex items-center group"
                >
                  <ChevronRight className="w-3 h-3 mr-1 text-slate-600 group-hover:text-cyan-400 transition" />
                  {t("footer.dealer_portal", "Dealer Account Portal")}
                </Link>
              </li>
              <li>
                <Link
                  to="/addresses"
                  onClick={() => triggerHaptic("selection")}
                  className="hover:text-white transition flex items-center group"
                >
                  <ChevronRight className="w-3 h-3 mr-1 text-slate-600 group-hover:text-cyan-400 transition" />
                  {t("footer.delivery_addresses", "Delivery Addresses")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4: Policies & Legal */}
          <div className="space-y-3.5">
            <h4 className="text-xs font-black uppercase tracking-wider text-white flex items-center space-x-2">
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400 dark:text-orange-400" />
              <span>{t("footer.policies_title", "Policies & Support")}</span>
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link
                  to="/shipping"
                  onClick={() => triggerHaptic("selection")}
                  className="hover:text-white transition flex items-center group"
                >
                  <ChevronRight className="w-3 h-3 mr-1 text-slate-600 group-hover:text-cyan-400 transition" />
                  {t("footer.shipping_policy", "Shipping & Delivery")}
                </Link>
              </li>
              <li>
                <Link
                  to="/returns-policy"
                  onClick={() => triggerHaptic("selection")}
                  className="hover:text-white transition flex items-center group"
                >
                  <ChevronRight className="w-3 h-3 mr-1 text-slate-600 group-hover:text-cyan-400 transition" />
                  {t("footer.return_policy", "Returns & Replacement")}
                </Link>
              </li>
              <li>
                <Link
                  to="/warranty"
                  onClick={() => triggerHaptic("selection")}
                  className="hover:text-white transition flex items-center group"
                >
                  <ChevronRight className="w-3 h-3 mr-1 text-slate-600 group-hover:text-cyan-400 transition" />
                  {t("footer.warranty_terms", "Factory Warranty Terms")}
                </Link>
              </li>
              <li>
                <Link
                  to="/wholesale-terms"
                  onClick={() => triggerHaptic("selection")}
                  className="hover:text-white transition flex items-center group"
                >
                  <ChevronRight className="w-3 h-3 mr-1 text-slate-600 group-hover:text-cyan-400 transition" />
                  {t("footer.wholesale_terms", "Wholesale Terms & Conditions")}
                </Link>
              </li>
              <li>
                <Link
                  to="/privacy"
                  onClick={() => triggerHaptic("selection")}
                  className="hover:text-white transition flex items-center group"
                >
                  <ChevronRight className="w-3 h-3 mr-1 text-slate-600 group-hover:text-cyan-400 transition" />
                  {t("footer.privacy_policy", "Privacy & Data Policy")}
                </Link>
              </li>
              <li>
                <Link
                  to="/about"
                  onClick={() => triggerHaptic("selection")}
                  className="hover:text-white transition flex items-center group"
                >
                  <ChevronRight className="w-3 h-3 mr-1 text-slate-600 group-hover:text-cyan-400 transition" />
                  {t("footer.about_us", "About URT Wholesale")}
                </Link>
              </li>
              <li>
                <Link
                  to="/contact"
                  onClick={() => triggerHaptic("selection")}
                  className="hover:text-white transition flex items-center group"
                >
                  <ChevronRight className="w-3 h-3 mr-1 text-slate-600 group-hover:text-cyan-400 transition" />
                  {t("footer.contact_support", "Contact & Support Desk")}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* ── 3. Payment & Security Badges Ribbon ── */}
        <div className="pt-8 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
            <span className="flex items-center space-x-1.5 text-slate-400">
              <Lock className="w-3.5 h-3.5 text-cyan-400 dark:text-orange-400" />
              <span>{t("footer.encrypted_payments", "Encrypted UPI & B2B Banking")}</span>
            </span>
            <span className="hidden sm:inline text-slate-700">•</span>
            <span className="flex items-center space-x-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>{t("footer.cargo_dispatch", "Direct Surface & Air Cargo")}</span>
            </span>
            <span className="hidden sm:inline text-slate-700">•</span>
            <span className="text-slate-400">
              {t("footer.itc_eligible", "GST Tax Invoiced (ITC Eligible)")}
            </span>
          </div>

          <div className="flex items-center space-x-2 text-[11px] text-slate-400 bg-slate-800/80 px-3 py-1.5 rounded-full border border-slate-700/60">
            <span>{t("footer.payment_modes", "Payment Modes: UPI • GPay • PhonePe • NEFT / RTGS")}</span>
          </div>
        </div>

        {/* ── 4. Language Selection, Copyright & Disclaimer ── */}
        <div className="pt-6 border-t border-slate-800/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-400 text-center sm:text-left">
          <div className="flex items-center space-x-3">
            <Languages className="w-4 h-4 text-cyan-400 dark:text-orange-400" />
            <div className="flex items-center space-x-1 bg-slate-800 p-0.5 rounded-lg border border-slate-700/60">
              <button
                type="button"
                onClick={() => setLanguage("en")}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                  !isHindi
                    ? "bg-cyan-500 text-white shadow-xs"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => setLanguage("hi")}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                  isHindi
                    ? "bg-cyan-500 text-white shadow-xs"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                हिन्दी
              </button>
            </div>
          </div>

          <p>
            &copy; {currentYear} {storeName}. {t("footer.rights_reserved", "All rights reserved. Exclusively for authorized dealers & retail mobile counters.")}
          </p>
          <p className="text-[10px] text-slate-400">
            {t("footer.pricing_note", "Wholesale base pricing. Tax invoice provided upon order confirmation.")}
          </p>
        </div>
      </div>
    </footer>
  );
}
