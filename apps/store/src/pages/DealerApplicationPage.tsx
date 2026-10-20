import { useState } from "react";
import { useNavigate, Link } from "react-router";
import { submitDealerApplication } from "../services/storeService";
import { useSettings } from "../context/SettingsContext";
import { triggerHaptic } from "../utils/haptics";
import {
  ArrowLeft,
  Sparkles,
  CheckCircle2,
  Truck,
  ShieldCheck,
  Percent,
  Copy,
  Check,
  MessageCircle,
  Loader2,
  AlertCircle,
  ChevronRight,
} from "lucide-react";

const CATEGORY_OPTIONS = [
  "9H Sapphire Tempered Glass",
  "GaN Fast Power Adapters",
  "Ballistic Braided Cables",
  "TWS Audio & Wireless Earphones",
  "MagSafe Car Mounts & Holders",
  "High-Capacity Power Banks",
  "Armor Protective Cases",
];

const BUSINESS_TYPE_OPTIONS = [
  { value: "retailer", label: "Retail Shop / Store Owner" },
  { value: "distributor", label: "Regional Wholesale Distributor" },
  { value: "online_seller", label: "E-Commerce / Online Reseller" },
  { value: "wholesaler", label: "Market Wholesaler / Trader" },
  { value: "other", label: "Corporate / Institutional Buyer" },
];

const VOLUME_OPTIONS = [
  { value: "under_25k", label: "Under ₹25,000 / month" },
  { value: "25k_1l", label: "₹25,000 – ₹1,00,000 / month" },
  { value: "1l_5l", label: "₹1,00,000 – ₹5,00,000 / month" },
  { value: "above_5l", label: "Above ₹5,00,000 / month (Super Stockist)" },
];

export function DealerApplicationPage() {
  const navigate = useNavigate();
  const { whatsappNumber } = useSettings();

  // Form State
  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [mobile, setMobile] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [gstin, setGstin] = useState("");
  const [businessType, setBusinessType] = useState("retailer");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");
  const [volume, setVolume] = useState("25k_1l");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([
    "9H Sapphire Tempered Glass",
    "GaN Fast Power Adapters",
  ]);
  const [message, setMessage] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  // Status State
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{
    application_no: string;
    created_at: string;
  } | null>(null);

  const [copiedAppNo, setCopiedAppNo] = useState(false);

  function toggleCategory(cat: string) {
    triggerHaptic("selection");
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  }

  function handleCopyAppNo(appNo: string) {
    triggerHaptic("selection");
    navigator.clipboard.writeText(appNo);
    setCopiedAppNo(true);
    setTimeout(() => setCopiedAppNo(false), 2000);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    triggerHaptic("medium");
    setError(null);

    // Client-side validations
    if (!businessName.trim() || businessName.trim().length < 2) {
      setError("Please provide a valid Business / Shop name (at least 2 characters).");
      return;
    }
    if (!ownerName.trim() || ownerName.trim().length < 2) {
      setError("Please enter the contact person / proprietor name.");
      return;
    }
    const cleanMobile = mobile.replace(/[^0-9]/g, "");
    if (cleanMobile.length !== 10) {
      setError("Please enter a valid 10-digit mobile number.");
      return;
    }
    if (pincode.trim() && pincode.replace(/[^0-9]/g, "").length !== 6) {
      setError("Pincode must be exactly 6 digits.");
      return;
    }
    if (
      gstin.trim() &&
      !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin.trim().toUpperCase())
    ) {
      setError("GSTIN format is invalid. Expected format: 22AAAAA0000A1Z5");
      return;
    }
    if (!acceptedTerms) {
      setError("You must review and accept the Urbanrat Authorized Dealer Terms.");
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        business_name: businessName.trim(),
        owner_name: ownerName.trim(),
        mobile: cleanMobile,
        whatsapp: whatsapp.trim() ? whatsapp.replace(/[^0-9]/g, "") : null,
        email: email.trim() || null,
        gstin: gstin.trim() ? gstin.trim().toUpperCase() : null,
        business_type: businessType,
        address: address.trim() || null,
        city: city.trim() || null,
        state: state.trim() || null,
        pincode: pincode.trim() ? pincode.replace(/[^0-9]/g, "") : null,
        expected_monthly_volume: volume,
        categories_interest: selectedCategories,
        message: message.trim() || null,
        accepted_terms: true,
      };

      const res = await submitDealerApplication(payload);
      triggerHaptic("success");
      setSuccessData(res);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: any) {
      console.error("Dealer submission error:", err);
      setError(err?.message || "Failed to submit dealer application. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // Success Confirmation Screen
  if (successData) {
    const whatsappFastTrackUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
      `Hello Urbanrat Depot, I have submitted an Authorized Dealer application with ID ${successData.application_no} for ${businessName}. Please review our application.`
    )}`;

    return (
      <div className="max-w-3xl mx-auto space-y-6 pb-20 animate-in fade-in duration-300">
        <div className="bg-white rounded-3xl border border-slate-200/80 p-8 sm:p-12 text-center space-y-6 shadow-sm">
          <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto ring-8 ring-emerald-50/50">
            <CheckCircle2 className="w-9 h-9 stroke-[2.5]" />
          </div>

          <div className="space-y-2">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
              Application Submitted Successfully
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Welcome to the Dealer Pipeline!
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 max-w-lg mx-auto leading-relaxed">
              Your authorized dealer application for <strong>{businessName}</strong> has been logged directly with our regional wholesale verification team.
            </p>
          </div>

          {/* Application Reference Number Card */}
          <div className="bg-slate-50 rounded-2xl border border-slate-200/80 p-5 max-w-md mx-auto space-y-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Application Tracking Number
            </span>
            <div className="flex items-center justify-center space-x-3">
              <span className="text-xl sm:text-2xl font-black text-slate-900 font-mono tracking-wider">
                {successData.application_no}
              </span>
              <button
                type="button"
                onClick={() => handleCopyAppNo(successData.application_no)}
                className="p-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 transition cursor-pointer shadow-2xs"
                title="Copy Application Number"
              >
                {copiedAppNo ? (
                  <Check className="w-4 h-4 text-emerald-600 stroke-3" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              Submitted on{" "}
              {new Date(successData.created_at).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </p>
          </div>

          {/* Next Steps */}
          <div className="text-left bg-brand-light/10 border border-brand-light/25 rounded-2xl p-5 max-w-lg mx-auto space-y-3">
            <p className="text-xs font-black text-brand-dark uppercase tracking-wider">
              What Happens Next?
            </p>
            <ul className="text-xs text-slate-700 space-y-2">
              <li className="flex items-start space-x-2">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-dark shrink-0 mt-1.5" />
                <span>Our commercial team verifies business credentials and territory exclusivity.</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-dark shrink-0 mt-1.5" />
                <span>You will receive an onboarding call / WhatsApp confirmation within <strong>24–48 hours</strong>.</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-dark shrink-0 mt-1.5" />
                <span>Upon approval, your unique <strong>Dealer Code (DLR-XXXX)</strong> will unlock exclusive pricing.</span>
              </li>
            </ul>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
            <a
              href={whatsappFastTrackUrl}
              target="_blank"
              rel="noreferrer"
              onClick={() => triggerHaptic("selection")}
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-6 py-3 rounded-full text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition cursor-pointer"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Fast-Track on WhatsApp</span>
            </a>

            <Link
              to="/marketplace"
              onClick={() => triggerHaptic("selection")}
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-6 py-3 rounded-full text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition"
            >
              <span>Explore Wholesale Catalog</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20 animate-in fade-in duration-300">
      {/* ── Top Header Navigation ── */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            triggerHaptic("selection");
            navigate(-1);
          }}
          className="inline-flex items-center space-x-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200/80 px-3 py-1.5 rounded-full shadow-2xs hover:bg-slate-50 transition cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back</span>
        </button>

        <Link
          to="/page/dealer-terms"
          onClick={() => triggerHaptic("selection")}
          className="text-xs font-bold text-brand-dark hover:underline flex items-center space-x-1"
        >
          <span>View Dealer Terms</span>
          <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      {/* ── Page Hero Card ── */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-10 shadow-xs relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-linear-to-br from-brand-light/20 to-brand-dark/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

        <div className="relative space-y-3 max-w-2xl">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-brand-light/15 text-brand-dark border border-brand-light/30">
            Official B2B Channel
          </span>

          <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight leading-tight">
            Apply to Become an Authorized Urbanrat Dealer
          </h1>

          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Gain direct access to tier-1 manufacturing rates, reserved regional inventory, official in-store retail displays, and dedicated account managers.
          </p>
        </div>

        {/* ── 4 Key Dealer Privileges ── */}
        <div className="relative grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 mt-6 border-t border-slate-100">
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/60 space-y-1">
            <Percent className="w-4 h-4 text-brand-dark" />
            <p className="text-xs font-bold text-slate-900">Direct Margins</p>
            <p className="text-[10px] text-slate-500">Unfiltered factory-floor wholesale rates</p>
          </div>
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/60 space-y-1">
            <Truck className="w-4 h-4 text-emerald-600" />
            <p className="text-xs font-bold text-slate-900">Priority Dispatch</p>
            <p className="text-[10px] text-slate-500">Same-day express courier dispatch</p>
          </div>
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/60 space-y-1">
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            <p className="text-xs font-bold text-slate-900">100% DOA Guarantee</p>
            <p className="text-[10px] text-slate-500">48-hour 1-to-1 broken transit swap</p>
          </div>
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/60 space-y-1">
            <Sparkles className="w-4 h-4 text-amber-600" />
            <p className="text-xs font-bold text-slate-900">POP Displays</p>
            <p className="text-[10px] text-slate-500">Retail counter displays &amp; marketing kits</p>
          </div>
        </div>
      </div>

      {/* ── Application Form Card ── */}
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-10 shadow-xs space-y-6"
      >
        <div className="border-b border-slate-100 pb-4">
          <h2 className="text-lg font-black text-slate-900 tracking-tight">
            Commercial Business Profile
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Fill in your business details. All information is confidential and protected by RLS.
          </p>
        </div>

        {error && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-800 flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Business / Shop Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 block">
              Business / Store Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Apex Mobile Care & Accessories"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-light focus:border-brand-dark transition"
            />
          </div>

          {/* Contact Person Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 block">
              Proprietor / Contact Person <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Rajesh Kumar"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-light focus:border-brand-dark transition"
            />
          </div>

          {/* Mobile Number */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 block">
              Primary Mobile Number (10 digits) <span className="text-rose-500">*</span>
            </label>
            <div className="flex items-center">
              <span className="px-3 py-2.5 bg-slate-100 border border-r-0 border-slate-200 rounded-l-xl text-xs font-bold text-slate-600 select-none">
                +91
              </span>
              <input
                type="tel"
                required
                maxLength={10}
                placeholder="9876543210"
                value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/[^0-9]/g, ""))}
                className="w-full px-3.5 py-2.5 rounded-r-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-light focus:border-brand-dark transition"
              />
            </div>
          </div>

          {/* WhatsApp Number */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 block">
              WhatsApp Number (Optional)
            </label>
            <div className="flex items-center">
              <span className="px-3 py-2.5 bg-slate-100 border border-r-0 border-slate-200 rounded-l-xl text-xs font-bold text-slate-600 select-none">
                +91
              </span>
              <input
                type="tel"
                maxLength={10}
                placeholder="9876543210"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value.replace(/[^0-9]/g, ""))}
                className="w-full px-3.5 py-2.5 rounded-r-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-light focus:border-brand-dark transition"
              />
            </div>
          </div>

          {/* Email Address */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 block">
              Business Email Address
            </label>
            <input
              type="email"
              placeholder="e.g. apex.mobiles@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-light focus:border-brand-dark transition"
            />
          </div>

          {/* GSTIN */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 block">
              GSTIN (Optional, for Input Tax Credit)
            </label>
            <input
              type="text"
              maxLength={15}
              placeholder="e.g. 22AAAAA0000A1Z5"
              value={gstin}
              onChange={(e) => setGstin(e.target.value.toUpperCase())}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-light focus:border-brand-dark transition uppercase font-mono"
            />
          </div>

          {/* Business Type */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 block">
              Primary Business Model <span className="text-rose-500">*</span>
            </label>
            <select
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-light focus:border-brand-dark transition cursor-pointer"
            >
              {BUSINESS_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Expected Monthly Purchase Volume */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 block">
              Expected Monthly Volume <span className="text-rose-500">*</span>
            </label>
            <select
              value={volume}
              onChange={(e) => setVolume(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-light focus:border-brand-dark transition cursor-pointer"
            >
              {VOLUME_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Address Details */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div className="sm:col-span-3 space-y-1.5">
            <label className="text-xs font-bold text-slate-700 block">
              Shop / Warehouse Address
            </label>
            <input
              type="text"
              placeholder="e.g. Shop 12, First Floor, Central Electronics Market"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-light focus:border-brand-dark transition"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 block">City</label>
            <input
              type="text"
              placeholder="e.g. Delhi"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-light focus:border-brand-dark transition"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 block">State</label>
            <input
              type="text"
              placeholder="e.g. Delhi NCR"
              value={state}
              onChange={(e) => setState(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-light focus:border-brand-dark transition"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 block">
              6-Digit Postal Pincode
            </label>
            <input
              type="text"
              maxLength={6}
              placeholder="e.g. 110006"
              value={pincode}
              onChange={(e) => setPincode(e.target.value.replace(/[^0-9]/g, ""))}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-light focus:border-brand-dark transition"
            />
          </div>
        </div>

        {/* Categories of Interest (Interactive Pills) */}
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <label className="text-xs font-bold text-slate-700 block">
            Accessories &amp; Product Categories You Wish to Stock
          </label>
          <div className="flex flex-wrap gap-2">
            {CATEGORY_OPTIONS.map((cat) => {
              const selected = selectedCategories.includes(cat);
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleCategory(cat)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
                    selected
                      ? "bg-brand-gradient text-white shadow-2xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {selected && <Check className="w-3.5 h-3.5 stroke-3" />}
                  <span>{cat}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Additional Message / Notes */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 block">
            Additional Message / Notes for Depot Manager (Optional)
          </label>
          <textarea
            rows={3}
            placeholder="Tell us about your existing retail reach, customer footfall, or target models..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-light focus:border-brand-dark transition"
          />
        </div>

        {/* Terms Acceptance */}
        <div className="pt-2">
          <label className="flex items-start space-x-3 cursor-pointer">
            <input
              type="checkbox"
              required
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded text-brand-dark border-slate-300 focus:ring-brand-light cursor-pointer"
            />
            <span className="text-xs text-slate-600 leading-relaxed">
              I agree to the{" "}
              <Link
                to="/page/dealer-terms"
                target="_blank"
                className="font-bold text-brand-dark hover:underline"
              >
                Urbanrat Authorized Dealer Agreement
              </Link>{" "}
              and confirm all provided commercial and contact details are accurate.
            </span>
          </label>
        </div>

        {/* Submit Button */}
        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-[11px] text-slate-400">
            🔒 Protected by Row Level Security. No credit card required.
          </p>

          <button
            type="submit"
            disabled={submitting}
            className="w-full sm:w-auto px-8 py-3 rounded-full text-xs font-bold text-white bg-brand-gradient hover:opacity-95 shadow-md transition flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Registering Application...</span>
              </>
            ) : (
              <>
                <span>Submit Dealer Application</span>
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
