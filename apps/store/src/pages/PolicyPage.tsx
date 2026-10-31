import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router";
import { getStorePage } from "../services/storeService";
import { useSettings } from "../context/SettingsContext";
import { triggerHaptic } from "../utils/haptics";
import type { StorePage } from "@urbanrat/shared";
import {
  ArrowLeft,
  Shield,
  FileText,
  Info,
  Truck,
  RotateCcw,
  ShieldCheck,
  Phone,
  MessageCircle,
  ExternalLink,
  ChevronRight,
  Clock,
  Sparkles,
  Building2,
} from "lucide-react";

interface PolicyPageProps {
  initialSlug?: string;
}

/** Default hardcoded fallback policy copy for high reliability */
const POLICY_FALLBACKS: Record<
  string,
  {
    title: string;
    summary: string;
    icon: typeof Info;
    category: string;
    content: string;
  }
> = {
  about: {
    title: "About Urbanrat Labs",
    summary: "Our factory-direct wholesale story & quality pledge",
    icon: Info,
    category: "Company & Origins",
    content: `Urbanrat is a single-vendor specialized supplier of high-grade mobile accessories and digital electronics, supplied by URP Wholesale.

We bypass distributor markups and intermediate traders to provide retailers, corporate buyers, and tech enthusiasts direct access to precision 9H sapphire tempered glass, GaN power bricks, ballistic braided cables, and audio hardware.

### Factory Direct Sourcing
Every single SKU in the Urbanrat catalog is sourced directly from certified manufacturing facilities. By eliminating multiple middlemen, we guarantee honest factory-floor wholesale pricing with certified batch-level testing.

### Rigorous Quality Assurance
Our Shenzhen and Delhi depot QC teams run comprehensive physical drop, bend, thermal, and electrical load benchmarks before any product is boxed and stocked.

### Pan-India B2B Dispatch
We operate centralized fulfillment depots equipped for rapid same-day dispatches across tier-1, tier-2, and remote regional destinations in India.`,
  },
  terms: {
    title: "Terms & Wholesale Policy",
    summary: "Dead-on-arrival replacements, dispatch rules, and invoice policy",
    icon: FileText,
    category: "Legal & Commercial",
    content: `### 1. Quality & QC Guarantee
Every unit undergoes electrical circuit testing and drop testing before boxing. Sealed wholesale cartons undergo random lot sampling.

### 2. Transit Replacements & DOA Policy
Any parcel reported broken or dead-on-arrival within 48 hours of courier delivery is eligible for immediate 1-to-1 swap. Unboxing video evidence is recommended for rapid dispute clearance.

### 3. Wholesale Pricing & Minimums
Volume price tiers apply automatically based on total line item quantity. Wholesale buyers are required to respect the designated minimum order quantity (MOQ) specified per product.

### 4. Invoicing & GST Compliance
Invoices are generated electronically with comprehensive GST breakdowns upon order confirmation. Input Tax Credit (ITC) details are reflected on all official invoices.`,
  },
  privacy: {
    title: "Privacy Policy & Security",
    summary: "Encrypted authentication, data privacy, and zero data trading",
    icon: Shield,
    category: "Data & Security",
    content: `### 1. Data Protection Commitment
Your phone numbers, delivery coordinates, and purchase records are secured with Row Level Security (RLS) through Supabase and never shared with or sold to third-party marketing brokers.

### 2. WhatsApp Interactions
WhatsApp interactions and order notifications are processed through official business APIs under end-to-end encrypted protocols.

### 3. Payment & Commercial Records
We maintain secure encrypted logs of order transactions strictly for tax compliance, accounting audits, and warranty tracking.

### 4. Right to Deletion
Registered commercial partners can request full archival or account removal at any time by contacting our data compliance desk.`,
  },
  shipping: {
    title: "Shipping & Delivery Logistics",
    summary: "Pan-India express logistics, turnaround times, and door delivery",
    icon: Truck,
    category: "Fulfillment & Dispatch",
    content: `### 1. Express Dispatch Turnaround
Orders placed before 2:00 PM IST on business days are dispatched same-day from our central distribution hub.

### 2. Carrier Partners
We partner with leading tier-1 express cargo providers (Bluedart, Delhivery, DTDC, and SafeXpress) to ensure rapid, trackable door delivery across all serviceable Indian pincodes.

### 3. Standard Transit Timelines
- **Metro & Tier 1 Cities**: 2 to 3 business days.
- **Rest of India**: 4 to 6 business days.
- **Bulk Commercial Cargo (50kg+)**: Surface logistics with 5 to 7 business days delivery.

### 4. Real-time Tracking
Once dispatched, full airway bill (AWB) tracking numbers and courier direct links are sent automatically to your registered phone number and WhatsApp.`,
  },
  returns: {
    title: "Returns & Replacements Policy",
    summary: "Transit damage coverage and 1-to-1 replacement protocols",
    icon: RotateCcw,
    category: "Customer Protection",
    content: `### 1. 48-Hour DOA Claim Window
Any item received broken, cracked in transit, or dead-on-arrival must be reported to the WhatsApp Wholesale Desk within 48 hours of delivery.

### 2. Replacement Protocol
Upon visual verification, replacement units are dispatched in your subsequent order or couriered independently without restocking fees.

### 3. Non-Returnable Scenarios
- Items with customer-inflicted physical damage or water exposure.
- Products missing original retail packaging, barcodes, or serial stickers.
- Claims reported beyond the 48-hour delivery inspection window.`,
  },
  warranty: {
    title: "Warranty Policy",
    summary: "Factory warranty coverage terms for electronic accessories and cables",
    icon: ShieldCheck,
    category: "Product Warranty",
    content: `### 1. Warranty Periods
- **GaN Fast Chargers & Adapters**: 6 Months Replacement Warranty.
- **Braided Fast Charging Cables**: 6 Months Replacement Warranty.
- **Audio Gear (TWS / Earphones)**: 6 Months Functional Warranty.
- **Tempered Glass**: Transit break replacement only (inspect upon arrival).

### 2. Claim Procedure
To file a warranty claim, message our WhatsApp support desk with your original Order ID, a short video showcasing the issue, and the product serial sticker.

### 3. Exclusions
Warranty does not cover normal wear and tear, cable fraying caused by accidental pulling, connector corrosion, or liquid ingress.`,
  },
  "wholesale-terms": {
    title: "Wholesale Terms & Conditions",
    summary: "B2B purchasing guidelines, bulk volume tier pricing, and tax invoice terms",
    icon: Building2,
    category: "Commercial Agreement",
    content: `### 1. Wholesale Buyer Status
Urbanrat operates exclusively as a wholesale supplier for retailers, re-sellers, mobile repair centers, and corporate purchasers.

### 2. Volume Tier Matrix
Tier pricing is computed dynamically per order line. Reaching higher quantity thresholds instantly unlocks factory-floor unit pricing without manual negotiation.

### 3. Payment Terms
All wholesale orders are processed via confirmed digital bank transfer, UPI, or verified advance payment before dispatch. Credit terms are exclusively available to authorized dealers.`,
  },
  "dealer-terms": {
    title: "Authorized Dealer Terms",
    summary: "Dealer network criteria, regional wholesale privileges, and compliance",
    icon: Sparkles,
    category: "Dealer Partnership",
    content: `### 1. Territory Privileges
Authorized Urbanrat Dealers enjoy exclusive territory wholesale pricing, early access to new product releases, and priority warehousing reserves.

### 2. Minimum Quarterly Commitments
To maintain Authorized Dealer status, partners must fulfill agreed minimum monthly purchase volumes in their assigned sales territory.

### 3. Marketing & Merchandising Support
Dealers receive acrylic counter display stands, official branded acrylic signboards, and high-resolution digital marketing collateral for retail stores.`,
  },
  contact: {
    title: "Contact & Wholesale Support Desk",
    summary: "Direct factory desk, warehouse address, and business contact channels",
    icon: Phone,
    category: "Support & Help",
    content: `### Central Distribution Hub
**URP Wholesale / Urbanrat Distribution Center**  
Main Depot: Central Electronics Market, Sector 18, New Delhi, India  
Operating Hours: Monday – Saturday, 10:00 AM – 7:30 PM IST

### Direct Contact Channels
- **WhatsApp Wholesale Desk**: Direct chat for orders, dispatch status, and product catalogs.
- **Email Support**: support@urbanrat.store
- **Order Tracking**: Enter your URT Order ID in the Storefront Order tracker.`,
  },
};

const ALL_POLICY_LINKS = [
  { slug: "about", label: "About Urbanrat", icon: Info },
  { slug: "terms", label: "Terms & Wholesale", icon: FileText },
  { slug: "privacy", label: "Privacy Policy", icon: Shield },
  { slug: "shipping", label: "Shipping Logistics", icon: Truck },
  { slug: "returns", label: "Returns & DOA", icon: RotateCcw },
  { slug: "warranty", label: "Warranty Policy", icon: ShieldCheck },
  { slug: "wholesale-terms", label: "Wholesale Terms", icon: Building2 },
  { slug: "dealer-terms", label: "Dealer Terms", icon: Sparkles },
  { slug: "contact", label: "Contact Us", icon: Phone },
];

export function PolicyPage({ initialSlug }: PolicyPageProps) {
  const { slug: routeSlug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { whatsappNumber } = useSettings();

  const slug = (initialSlug || routeSlug || "about").toLowerCase().trim();

  const [page, setPage] = useState<StorePage | null>(null);
  const [loading, setLoading] = useState(true);

  const fallback = POLICY_FALLBACKS[slug] || {
    title: slug
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" "),
    summary: "Urbanrat B2B Store Policy",
    icon: FileText,
    category: "Store Policy",
    content: "Content is being updated by the store administrator.",
  };

  const loadPage = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getStorePage(slug);
      if (data && data.is_published !== false) {
        setPage(data);
      } else {
        setPage(null);
      }
    } catch {
      setPage(null);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  const title = page?.title || fallback.title;
  const summary = page?.summary || fallback.summary;
  const content = page?.content && page.content !== "TO BE UPDATED" ? page.content : fallback.content;
  const IconComponent = fallback.icon;

  const whatsappInquiryUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
    `Hello Urbanrat Support, I have a question regarding the "${title}" policy.`
  )}`;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 animate-in fade-in duration-300">
      {/* ── Top Navigation Bar ── */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            triggerHaptic("selection");
            navigate(-1);
          }}
          className="inline-flex items-center space-x-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 px-3 py-1.5 rounded-full shadow-2xs hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back</span>
        </button>

        <div className="flex items-center space-x-2">
          <Link
            to="/dealers"
            onClick={() => triggerHaptic("selection")}
            className="text-xs font-bold text-brand-dark dark:text-brand-light hover:underline flex items-center space-x-1"
          >
            <span>Become a Dealer</span>
            <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* ── Hero Header Card ── */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-white/10 p-6 sm:p-8 shadow-xs relative overflow-hidden">
        {/* Subtle decorative gradient aura */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-linear-to-br from-brand-light/10 to-brand-dark/5 dark:from-orange-500/10 dark:to-orange-700/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-brand-light/15 dark:bg-orange-500/15 text-brand-dark dark:text-brand-light border border-brand-light/30 dark:border-orange-500/30">
                {fallback.category}
              </span>
              <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium flex items-center space-x-1">
                <Clock className="w-3 h-3" />
                <span>Verified Policy</span>
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              {title}
            </h1>

            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-2xl">
              {summary}
            </p>
          </div>

          <div className="shrink-0 self-start sm:self-center">
            <div className="w-14 h-14 rounded-2xl bg-linear-to-br from-brand-light/20 to-brand-dark/15 dark:from-orange-500/20 dark:to-orange-600/15 border border-brand-light/30 dark:border-orange-500/30 flex items-center justify-center text-brand-dark dark:text-brand-light shadow-2xs">
              <IconComponent className="w-7 h-7" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Policy Content Body ── */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-white/10 p-6 sm:p-8 shadow-xs">
        {loading ? (
          <div className="space-y-4 py-8 animate-pulse">
            <div className="h-5 bg-slate-100 dark:bg-slate-800 rounded w-1/3" />
            <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-full" />
            <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-5/6" />
            <div className="h-5 bg-slate-100 dark:bg-slate-800 rounded w-1/4 pt-4" />
            <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-full" />
            <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-4/5" />
          </div>
        ) : (
          <article className="prose prose-slate dark:prose-invert max-w-none text-xs sm:text-sm leading-relaxed text-slate-700 dark:text-slate-300 space-y-4">
            {content.split("\n\n").map((block, idx) => {
              const trimmed = block.trim();
              if (!trimmed) return null;

              // Section Heading (###)
              if (trimmed.startsWith("### ")) {
                return (
                  <h3
                    key={idx}
                    className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight pt-4 pb-1 border-b border-slate-100 dark:border-white/10 flex items-center space-x-2"
                  >
                    <span className="w-1.5 h-4 rounded-full bg-brand-dark dark:bg-brand-light inline-block" />
                    <span>{trimmed.replace(/^###\s+/, "")}</span>
                  </h3>
                );
              }

              // Subheading (##)
              if (trimmed.startsWith("## ")) {
                return (
                  <h2
                    key={idx}
                    className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight pt-5 pb-1 border-b border-slate-100 dark:border-white/10"
                  >
                    {trimmed.replace(/^##\s+/, "")}
                  </h2>
                );
              }

              // Bullet List
              if (trimmed.startsWith("- ")) {
                const items = trimmed.split("\n").filter((l) => l.trim().startsWith("- "));
                return (
                  <ul key={idx} className="space-y-1.5 pl-2">
                    {items.map((item, itemIdx) => {
                      const text = item.replace(/^-\s+/, "");
                      // Bold prefix detection (e.g. **Bold Title**: Text)
                      const boldMatch = text.match(/^\*\*([^*]+)\*\*:\s*(.*)/);
                      return (
                        <li key={itemIdx} className="flex items-start space-x-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-brand-dark dark:bg-brand-light shrink-0 mt-1.5" />
                          <span>
                            {boldMatch ? (
                              <>
                                <strong className="font-bold text-slate-900 dark:text-white">
                                  {boldMatch[1]}:
                                </strong>{" "}
                                {boldMatch[2]}
                              </>
                            ) : (
                              text
                            )}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                );
              }

              // Regular paragraph
              return (
                <p key={idx} className="text-slate-600 dark:text-slate-300 leading-relaxed">
                  {trimmed}
                </p>
              );
            })}
          </article>
        )}

        {/* WhatsApp Help CTA inside the document */}
        <div className="mt-8 pt-6 border-t border-slate-200/60 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/70 dark:bg-slate-800/80 p-4 rounded-2xl">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-white">
                Have questions about this policy?
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Direct WhatsApp line to our factory logistics &amp; commercial manager.
              </p>
            </div>
          </div>

          <a
            href={whatsappInquiryUrl}
            target="_blank"
            rel="noreferrer"
            onClick={() => triggerHaptic("selection")}
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition shrink-0 cursor-pointer"
          >
            <MessageCircle className="w-4 h-4" />
            <span>Chat on WhatsApp</span>
            <ExternalLink className="w-3 h-3 opacity-80" />
          </a>
        </div>
      </div>

      {/* ── Related Policies Navigation Grid ── */}
      <div className="space-y-3">
        <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
          Explore Other Wholesale Policies &amp; Info
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {ALL_POLICY_LINKS.filter((item) => item.slug !== slug).map((item) => {
            const ItemIcon = item.icon;
            return (
              <Link
                key={item.slug}
                to={`/page/${item.slug}`}
                onClick={() => triggerHaptic("selection")}
                className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 border border-slate-200/80 dark:border-white/10 flex items-center justify-between transition group shadow-2xs"
              >
                <div className="flex items-center space-x-3 min-w-0 pr-2">
                  <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 group-hover:bg-brand-light/20 dark:group-hover:bg-orange-500/20 group-hover:text-brand-dark dark:group-hover:text-brand-light flex items-center justify-center text-slate-600 dark:text-slate-400 transition shrink-0">
                    <ItemIcon className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white truncate">
                    {item.label}
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-brand-dark dark:group-hover:text-brand-light group-hover:translate-x-0.5 transition" />
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
