import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { useSettings } from "../context/SettingsContext";
import { useLanguage } from "../context/LanguageContext";
import { triggerHaptic } from "../utils/haptics";
import type {
  DealershipTierMargin,
  DealershipItemShowcase,
  DealershipBenefitComparison,
  DealershipArticle,
} from "@urbanrat/shared";
import {
  fetchDealershipMargins,
  fetchDealershipShowcases,
  fetchDealershipBenefits,
  fetchDealershipArticles,
} from "../services/storeService";
import {
  Sparkles,
  TrendingUp,
  Percent,
  Truck,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  ChevronDown,
  PackageCheck,
  MessageCircle,
  ArrowLeft,
  ChevronRight,
  Check,
  X,
  GitBranch,
} from "lucide-react";

// Default Fallback Seeds (Used while loading or if tables are freshly migrated)
const FALLBACK_ARTICLES: DealershipArticle[] = [
  {
    id: "fb-art-branded",
    article_type: "branded",
    title: "URT Original Branded Gear Dealership",
    short_summary:
      "Engineered for premium retail counters seeking higher ticket sizes, brand loyalty, certified electrical safety, and complete 1-year swap security.",
    content:
      "The Urbanrat Original Branded Dealership is designed for electronics stores and smartphone showrooms catering to quality-conscious consumers. Every branded item features precision aerospace Gallium Nitride internals, 9H sapphire-infused glass, tamper-evident retail blister packaging, and official BIS safety certifications. As an authorized branded dealer, you command higher selling prices (up to ₹799 per charger, ₹1,499 per TWS), build customer counter trust, and receive unconditional 1-year over-the-counter replacement backing from our central depot.",
    badge: "PREMIUM AUTHENTIC",
    key_points: [
      "Official Urbanrat laser-etched branding and security QR seal",
      "Full BIS, CE & RoHS certified electrical safety standards",
      "Command premium retail prices (₹599 to ₹1,499 ticket size)",
      "1-Year instant over-the-counter 1-for-1 replacement swap",
      "Complimentary acrylic counter display stands and branded posters",
    ],
    sort_order: 1,
    is_active: true,
  },
  {
    id: "fb-art-copy",
    article_type: "copy",
    title: "High-Turnover Compatible (Normal / Copy) Dealership",
    short_summary:
      "Engineered for maximum counter volume, rapid daily stock rotation, lowest initial inventory barrier, and unmatched 400%+ cash margin velocity.",
    content:
      "The Compatible (Normal / Copy) Dealership model targets mass-market retail outlets, repair kiosks, and busy suburban mobile counters where daily footfall demands affordable replacements. These items deliver commercial-grade performance at unfiltered factory floor unit costs (e.g. ₹18 for 9H glass, ₹38 for 120W cables). While packaged in unbranded bulk blisters or generic sleeves, they allow shop owners to rotate working capital 4 to 6 times a month with extreme profit margins of 300% to 700%, capturing every budget-sensitive walk-in customer without financial friction.",
    badge: "FAST TURNOVER COMPATIBLE",
    key_points: [
      "Lowest acquisition cost: start from ₹18/pc on tempered glass",
      "Huge markup potential: 300% to 700% gross profit margin",
      "Unbranded commercial blister packaging for flexible counter pricing",
      "Ideal for repair counters, high-density markets, and daily volume",
      "Rotate capital 4–6 times per month with minimal cash lock-in",
    ],
    sort_order: 2,
    is_active: true,
  },
];

const FALLBACK_SHOWCASES: DealershipItemShowcase[] = [
  {
    id: "fb-showcase-branded-1",
    item_type: "branded",
    title: "Urbanrat 65W GaN Pro Charger (Authentic Branded)",
    subtitle: "Next-gen GaN III dual USB-C architecture with aerospace heat dissipation",
    image_url: "/hero/dark/offer-gan-65w.jpg",
    packaging_type: "Metallic foil embossed retail box with anti-counterfeit QR seal",
    warranty_type: "1-Year Instant 1-for-1 DOA Replacement Swap",
    quality_grade: "Tier-1 GaN III Gallium Nitride Architecture",
    target_customer: "Premium smartphone & laptop owners seeking fast, safe charging",
    dealer_margin: "145% – 180% Gross Profit (₹414 – ₹514 per unit net gain)",
    features: [
      "Authentic Urbanrat laser logo and embossed branding",
      "Dual Type-C PD 65W + USB-A 30W multi-device delivery",
      "Active thermal throttling and flame-retardant casing",
      "BIS registered safety compliance certificate",
    ],
    sort_order: 1,
    is_active: true,
  },
  {
    id: "fb-showcase-copy-1",
    item_type: "copy",
    title: "Generic 65W GaN Style Charger (Normal / Copy Compatible)",
    subtitle: "Commercial grade dual-port fast charger in neutral bulk packaging",
    image_url: "/hero/light/offer-gan-65w.jpg",
    packaging_type: "Neutral retail blister box without proprietary brand logos",
    warranty_type: "7-Day Testing & DOA Replacement Guarantee",
    quality_grade: "Standard Commercial Dual-IC Circuitry",
    target_customer: "Price-sensitive buyers seeking quick everyday charging",
    dealer_margin: "250% – 320% Gross Profit (₹250 – ₹380 per unit net gain)",
    features: [
      "Clean neutral styling ready for counter retail pricing",
      "Standard 65W rated dual output with basic QC support",
      "Low unit wholesale cost (₹140 vs ₹285 branded)",
      "Rapid counter impulse buy turnover",
    ],
    sort_order: 2,
    is_active: true,
  },
  {
    id: "fb-showcase-branded-2",
    item_type: "branded",
    title: "Urbanrat 9H Diamond Armor Screen (Authentic Branded)",
    subtitle: "High-alumina double-tempered glass with oleophobic electroplated coating",
    image_url: "/hero/dark/offer-diamond-armor.jpg",
    packaging_type: "Rigid retail hardbook with alignment frame & microfiber kit",
    warranty_type: "1-Year Anti-Crack & Shatter Guarantee",
    quality_grade: "Double-Tempered 9H High-Alumina Sapphire Glass",
    target_customer: "iPhone & flagship Android owners demanding zero touch latency",
    dealer_margin: "300% – 450% Gross Profit (₹75 – ₹110 per unit net gain)",
    features: [
      "Oleophobic electroplated fingerprint-resistant layer",
      "Ultra-thin 0.33mm with 2.5D curved silk-printed borders",
      "Dust-free installation frame included in retail pack",
      "Urbanrat hologram quality verification sticker",
    ],
    sort_order: 3,
    is_active: true,
  },
  {
    id: "fb-showcase-copy-2",
    item_type: "copy",
    title: "Generic 9H Clear Tempered Glass (Normal / Copy Compatible)",
    subtitle: "Standard high-clarity tempered glass in bulk shop lots",
    image_url: "/hero/light/offer-diamond-armor.jpg",
    packaging_type: "Bulk foam sleeve pack of 50 pcs (Zero individual box cost)",
    warranty_type: "Dead-On-Arrival broken transit replacement only",
    quality_grade: "Standard Commercial Soda-Lime Glass",
    target_customer: "Walk-in counter repairs, screen replacement add-on sales",
    dealer_margin: "450% – 720% Gross Profit (₹81 – ₹131 per unit net gain)",
    features: [
      "Lowest unit cost in India (just ₹18 per piece)",
      "Sell for ₹99–₹149 counter installation with instant profit",
      "High turnover: 100+ pcs sold weekly per retail counter",
      "Zero packaging waste: compact 50-piece storage box",
    ],
    sort_order: 4,
    is_active: true,
  },
];

const FALLBACK_MARGINS: DealershipTierMargin[] = [
  {
    id: "fb-margin-1",
    item_type: "branded",
    category: "Fast Chargers",
    item_name: "Urbanrat 65W GaN Pro Dual-Port Charger",
    lot_size: "20 pcs / carton",
    cost_price: 285.0,
    retail_price_range: "₹699 – ₹799",
    margin_percentage: "+145% to +180%",
    profit_per_lot: "₹8,280 – ₹10,280",
    description: "Certified GaN III internals, aluminum heat dissipation, metallic retail box.",
    badge_text: "BRANDED ORIGINAL",
    sort_order: 1,
    is_active: true,
  },
  {
    id: "fb-margin-2",
    item_type: "copy",
    category: "Tempered Glass",
    item_name: "9H Sapphire Diamond Tempered Glass (Bulk)",
    lot_size: "50 pcs / box",
    cost_price: 18.0,
    retail_price_range: "₹99 – ₹149",
    margin_percentage: "+450% to +720%",
    profit_per_lot: "₹4,050 – ₹6,550",
    description: "Universal high-volume daily counter driver. 50-piece compact shop pack.",
    badge_text: "FAST TURNOVER COPY",
    sort_order: 2,
    is_active: true,
  },
  {
    id: "fb-margin-3",
    item_type: "branded",
    category: "Data Cables",
    item_name: "Urbanrat 120W Ballistic Braided Type-C",
    lot_size: "30 pcs / pack",
    cost_price: 38.0,
    retail_price_range: "₹149 – ₹199",
    margin_percentage: "+292% to +423%",
    profit_per_lot: "₹3,330 – ₹4,830",
    description: "Kevlar core, unbreakable alloy joints, metallic hang-tag packaging.",
    badge_text: "BRANDED ORIGINAL",
    sort_order: 3,
    is_active: true,
  },
  {
    id: "fb-margin-4",
    item_type: "copy",
    category: "Data Cables",
    item_name: "Generic 65W Fast Charge Braided Cable (Bulk)",
    lot_size: "50 pcs / bundle",
    cost_price: 19.0,
    retail_price_range: "₹79 – ₹99",
    margin_percentage: "+315% to +421%",
    profit_per_lot: "₹3,000 – ₹4,000",
    description: "Daily counter staple in polybag packaging for impulse add-on sales.",
    badge_text: "FAST TURNOVER COPY",
    sort_order: 4,
    is_active: true,
  },
  {
    id: "fb-margin-5",
    item_type: "branded",
    category: "Audio / TWS",
    item_name: "AirBass Pro Wireless ANC Earbuds (38H Playtime)",
    lot_size: "10 pcs / lot",
    cost_price: 420.0,
    retail_price_range: "₹1,199 – ₹1,399",
    margin_percentage: "+185% to +233%",
    profit_per_lot: "₹7,790 – ₹9,790",
    description: "13mm titanium composite drivers, ANC, luxury magnetic packaging.",
    badge_text: "BRANDED ORIGINAL",
    sort_order: 5,
    is_active: true,
  },
  {
    id: "fb-margin-6",
    item_type: "branded",
    category: "Power Banks",
    item_name: "Urbanrat 10,000mAh MagSafe Titanium Wireless Bank",
    lot_size: "10 pcs / lot",
    cost_price: 540.0,
    retail_price_range: "₹1,399 – ₹1,599",
    margin_percentage: "+159% to +196%",
    profit_per_lot: "₹8,590 – ₹10,590",
    description: "15W magnetic wireless + 20W PD Type-C, LED digital battery indicator.",
    badge_text: "BRANDED ORIGINAL",
    sort_order: 6,
    is_active: true,
  },
];

const FALLBACK_BENEFITS: DealershipBenefitComparison[] = [
  {
    id: "fb-b-1",
    feature_name: "Purchase Price Tier",
    normal_person_benefit: "Standard Retail MRP prices (Full price, zero wholesale discount)",
    urt_dealer_benefit: "Unfiltered Tier-1 Factory Direct Wholesale Depot Pricing",
    category: "Commercial",
    sort_order: 1,
    is_active: true,
  },
  {
    id: "fb-b-2",
    feature_name: "Profit Margin Potential",
    normal_person_benefit: "0% (End-use consumer consumption)",
    urt_dealer_benefit: "45% to 120%+ Gross Margin on Branded, up to 720% on Compatible Glass",
    category: "Commercial",
    sort_order: 2,
    is_active: true,
  },
  {
    id: "fb-b-3",
    feature_name: "Warranty & Defect Protection",
    normal_person_benefit: "Standard 7-day manufacturer DOA replacement",
    urt_dealer_benefit: "1-Year 100% Instant 1-for-1 Over-The-Counter Swap on Branded Gear",
    category: "Warranty",
    sort_order: 3,
    is_active: true,
  },
  {
    id: "fb-b-4",
    feature_name: "Payment & Credit Terms",
    normal_person_benefit: "100% Upfront Prepaid (UPI, Card, NetBanking)",
    urt_dealer_benefit: "15 to 30 Day Revolving Net Credit Lines (Post-KYC verification)",
    category: "Financial",
    sort_order: 4,
    is_active: true,
  },
  {
    id: "fb-b-5",
    feature_name: "Minimum Order Commitment",
    normal_person_benefit: "Single unit consumer purchases",
    urt_dealer_benefit: "Low 10-piece flexible mix-and-match lots across any product line",
    category: "Operational",
    sort_order: 5,
    is_active: true,
  },
  {
    id: "fb-b-6",
    feature_name: "Retail POS Marketing Kits",
    normal_person_benefit: "None",
    urt_dealer_benefit: "Free countertop acrylic display stands, posters & barcode tags",
    category: "Marketing",
    sort_order: 6,
    is_active: true,
  },
  {
    id: "fb-b-7",
    feature_name: "Dispatch & Logistics Priority",
    normal_person_benefit: "Standard surface courier (3 to 7 business days)",
    urt_dealer_benefit: "Priority 24H SafeXpress air/surface cargo with same-day tracking",
    category: "Logistics",
    sort_order: 7,
    is_active: true,
  },
  {
    id: "fb-b-8",
    feature_name: "Territory Protection",
    normal_person_benefit: "None",
    urt_dealer_benefit: "Exclusive pincode dealer rights for Gold & Platinum partners",
    category: "Commercial",
    sort_order: 8,
    is_active: true,
  },
  {
    id: "fb-b-9",
    feature_name: "Dedicated Support Desk",
    normal_person_benefit: "Standard email helpdesk",
    urt_dealer_benefit: "Dedicated Depot WhatsApp Manager with instant stock reservation",
    category: "Support",
    sort_order: 9,
    is_active: true,
  },
];

const FAQ_ITEMS = [
  {
    q: "How does the URT Wholesale Dealership work?",
    a: "Our dealership model connects verified retail store owners directly to our central manufacturing and import depots. You register your shop details (GSTIN or shop photo), receive verified dealer status within 4 hours, and immediately unlock factory-floor tier pricing on the platform with flexible MOQs starting from just 10 pieces.",
  },
  {
    q: "What is the difference between Branded and Copy Item Dealerships?",
    a: "Branded Dealership provides authentic Urbanrat engineered products with high retail ticket values (₹599–₹1,499), luxury retail packaging, and a 1-year over-the-counter replacement warranty. The Compatible (Normal/Copy) Dealership provides unbranded generic high-volume stock (like ₹18 tempered glass) focused on extreme counter velocity, lowest cost, and rapid daily capital turnover.",
  },
  {
    q: "Is GST mandatory to become an authorized dealer?",
    a: "No. While GSTIN allows you to claim input tax credit (ITC) and unlock institutional net credit lines, small shop retailers and repair counters can register with basic business proof (Udyam Aadhaar, trade license, or storefront photo).",
  },
  {
    q: "What is the minimum order quantity (MOQ)?",
    a: "Unlike traditional bulk importers that demand full master-carton commitments (500+ units), URT Wholesale permits mixed lot orders starting from just 10 pieces per product, enabling you to rotate inventory without locking up capital.",
  },
  {
    q: "How does the 1-to-1 warranty and DOA replacement work?",
    a: "If any item arrives damaged or develops a manufacturing defect within the warranty period, simply log a claim via your account. We dispatch replacements immediately or issue credit notes, complete with prepaid return labels.",
  },
  {
    q: "Can I get credit terms or Pay-Later options?",
    a: "Yes. After completing two successful prepaid orders, verified dealers can apply for 15-day to 30-day net credit lines backed by invoice financing.",
  },
];

export function DealershipProgramPage() {
  const navigate = useNavigate();
  const { whatsappNumber } = useSettings();
  const { isHindi } = useLanguage();

  // Live Database States
  const [articles, setArticles] = useState<DealershipArticle[]>(FALLBACK_ARTICLES);
  const [showcases, setShowcases] = useState<DealershipItemShowcase[]>(FALLBACK_SHOWCASES);
  const [margins, setMargins] = useState<DealershipTierMargin[]>(FALLBACK_MARGINS);
  const [benefits, setBenefits] = useState<DealershipBenefitComparison[]>(FALLBACK_BENEFITS);
  const [showcaseFilter, setShowcaseFilter] = useState<"all" | "branded" | "copy">("all");
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Load live data from Supabase on mount
  useEffect(() => {
    let isMounted = true;

    Promise.all([
      fetchDealershipArticles(),
      fetchDealershipShowcases(),
      fetchDealershipMargins(),
      fetchDealershipBenefits(),
    ])
      .then(([arts, shows, mrgs, bnfs]) => {
        if (!isMounted) return;
        if (arts && arts.length > 0) setArticles(arts);
        if (shows && shows.length > 0) setShowcases(shows);
        if (mrgs && mrgs.length > 0) setMargins(mrgs);
        if (bnfs && bnfs.length > 0) setBenefits(bnfs);
      })
      .catch((err) => {
        console.warn("Live dealership fetch fallback:", err);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const brandedArticle =
    articles.find((a) => a.article_type === "branded") || FALLBACK_ARTICLES[0]!;
  const copyArticle =
    articles.find((a) => a.article_type === "copy") || FALLBACK_ARTICLES[1]!;

  const filteredShowcases =
    showcaseFilter === "all"
      ? showcases
      : showcases.filter((s) => s.item_type === showcaseFilter);

  return (
    <div className="space-y-10 sm:space-y-14 pb-24 animate-in fade-in duration-300">
      {/* ── Top Header Navigation ── */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            triggerHaptic("selection");
            navigate(-1);
          }}
          className="inline-flex items-center space-x-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 px-3.5 py-1.5 rounded-full shadow-2xs hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{isHindi ? "पीछे जाएं" : "Back"}</span>
        </button>

        <div className="flex items-center space-x-2">
          <Link
            to="/dealers"
            onClick={() => triggerHaptic("selection")}
            className="inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-xl text-xs font-semibold text-on-primary bg-primary hover:bg-primary-hover active:bg-primary-active shadow-xs focus-visible:ring-2 ring-ring ring-offset-2 transition-all"
          >
            <span>{isHindi ? "डीलरशिप के लिए आवेदन करें" : "Apply for Dealership"}</span>
            <ChevronRight className="w-3.5 h-3.5 stroke-[2.5]" />
          </Link>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          1. HERO SECTION: DEALERSHIP OVERVIEW
          ══════════════════════════════════════════════════════════════════ */}
      <section className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-white/10 p-6 sm:p-12 shadow-xs relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-linear-to-br from-brand-light/20 to-brand-dark/10 dark:from-orange-500/15 dark:to-orange-700/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

        <div className="relative space-y-4 max-w-3xl">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-brand-light/20 dark:bg-orange-500/20 text-brand-dark dark:text-orange-300 border border-brand/20 dark:border-orange-500/30">
            <Sparkles className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>{isHindi ? "आधिकारिक B2B डीलरशिप एवं वितरण कार्यक्रम" : "Official B2B Dealership & Distribution Program"}</span>
          </div>

          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
            {isHindi
              ? "URT होलसेल डीलरशिप: सीधे सेंट्रल डिपो से हाई-मार्जिन मोबाइल एक्सेसरीज"
              : "URT Wholesale Dealership: High-Margin Mobile Accessories Direct from Central Depots"}
          </h1>

          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
            Choose between authentic <strong>Branded Original Gear</strong> (high ticket value &amp; 1-year swap)
            and fast-moving <strong>Compatible Copy Items</strong> (maximum daily counter cash turnover).
            All managed live from our central wholesale depot.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-3">
            <Link
              to="/dealers"
              onClick={() => triggerHaptic("selection")}
              className="inline-flex items-center space-x-2 px-6 py-3 rounded-2xl text-xs sm:text-sm font-semibold text-on-primary bg-primary hover:bg-primary-hover active:bg-primary-active shadow-xs hover:scale-[1.02] active:scale-[0.98] transition cursor-pointer"
            >
              <span>{isHindi ? "अभी डीलरशिप के लिए आवेदन करें" : "Apply for Dealership Now"}</span>
              <ArrowRight className="w-4 h-4 stroke-[2.5]" />
            </Link>

            <a
              href="#visual-tree"
              className="inline-flex items-center space-x-2 px-5 py-3 rounded-2xl text-xs sm:text-sm font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
            >
              <span>{isHindi ? "ब्रांडेड बनाम कॉपी आरेख ↓" : "Branded vs Copy Diagram ↓"}</span>
            </a>

            <a
              href="#differentiation-table"
              className="inline-flex items-center space-x-2 px-4 py-3 rounded-2xl text-xs sm:text-sm font-bold text-brand-dark dark:text-brand-light bg-brand/10 dark:bg-orange-500/10 border border-brand/20 dark:border-orange-500/20 hover:bg-brand/15 transition"
            >
              <span>{isHindi ? "डीलर लाभ तालिका ↓" : "Dealer vs Normal Perks ↓"}</span>
            </a>
          </div>
        </div>

        {/* 4 Core Pillars Chips */}
        <div className="relative grid grid-cols-2 lg:grid-cols-4 gap-3 pt-8 mt-8 border-t border-slate-100 dark:border-white/10">
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/60 dark:border-white/5 space-y-1">
            <div className="flex items-center space-x-2 text-brand-dark dark:text-brand-light">
              <Percent className="w-4 h-4 stroke-[2.5]" />
              <span className="text-xs font-black uppercase tracking-wider">Unfiltered Margins</span>
            </div>
            <p className="text-sm font-black text-slate-900 dark:text-white">Up to 720% ROI</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Factory-floor direct bulk rates</p>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/60 dark:border-white/5 space-y-1">
            <div className="flex items-center space-x-2 text-emerald-600 dark:text-emerald-400">
              <Truck className="w-4 h-4 stroke-[2.5]" />
              <span className="text-xs font-black uppercase tracking-wider">Express Freight</span>
            </div>
            <p className="text-sm font-black text-slate-900 dark:text-white">Same-Day 24H Dispatch</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">SafeXpress &amp; Delhivery air/surface</p>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/60 dark:border-white/5 space-y-1">
            <div className="flex items-center space-x-2 text-blue-600 dark:text-blue-400">
              <ShieldCheck className="w-4 h-4 stroke-[2.5]" />
              <span className="text-xs font-black uppercase tracking-wider">Zero Risk</span>
            </div>
            <p className="text-sm font-black text-slate-900 dark:text-white">100% DOA Guarantee</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Instant 1-for-1 replacement swap</p>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/60 dark:border-white/5 space-y-1">
            <div className="flex items-center space-x-2 text-amber-600 dark:text-amber-400">
              <PackageCheck className="w-4 h-4 stroke-[2.5]" />
              <span className="text-xs font-black uppercase tracking-wider">Low Commitments</span>
            </div>
            <p className="text-sm font-black text-slate-900 dark:text-white">From 10 Pieces MOQ</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">No huge capital lock-in required</p>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          2. VISUAL TREE DIAGRAM: BRANDED VS COPY DEALERSHIP PATHS
          ══════════════════════════════════════════════════════════════════ */}
      <section id="visual-tree" className="space-y-6">
        <div className="text-center max-w-xl mx-auto space-y-1">
          <span className="text-[11px] font-black uppercase tracking-widest text-brand-dark dark:text-brand-light">
            Visual Decision Architecture
          </span>
          <h2 className="text-xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            Understanding the Two Dealership Pathways
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            See at a glance how Branded Original Items and Normal Copy Items serve different counter needs
          </p>
        </div>

        {/* Visual Tree Diagram Card */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-white/10 p-6 sm:p-10 shadow-xs space-y-6">
          {/* Root node */}
          <div className="flex flex-col items-center text-center">
            <div className="px-5 py-2.5 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs sm:text-sm font-black shadow-md flex items-center space-x-2">
              <GitBranch className="w-4 h-4 text-cyan-400 dark:text-orange-500" />
              <span>URT Wholesale Central Depot Dealership</span>
            </div>
            <div className="w-0.5 h-6 bg-slate-300 dark:bg-slate-700 my-1" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
              Choose or combine both inventory streams
            </span>
            <div className="w-0.5 h-6 bg-slate-300 dark:bg-slate-700 my-1" />
          </div>

          {/* Two Branches Side-by-Side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
            {/* Connecting line on desktop */}
            <div className="hidden md:block absolute top-0 left-1/4 right-1/4 h-0.5 bg-slate-200 dark:bg-slate-700 -mt-3" />

            {/* Branch 1: Branded Item Dealership */}
            <div className="rounded-3xl border-2 border-primary-border p-5 sm:p-6 bg-primary-soft/30 space-y-4">
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-brand-dark text-white">
                  PATH A: BRANDED ORIGINAL
                </span>
                <span className="text-xs font-bold text-primary">
                  ₹599 – ₹1,499 Ticket Size
                </span>
              </div>

              <div className="space-y-1">
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                  Urbanrat Original Engineered Gear
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  High-ticket retail gear built with GaN III semiconductors, high-alumina sapphire glass, and aerospace nylon.
                </p>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-white/10 text-xs">
                <div className="flex items-center space-x-2 text-slate-700 dark:text-slate-300 font-medium">
                  <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span><strong>Packaging:</strong> Premium metallic retail hard-box with security QR seal</span>
                </div>
                <div className="flex items-center space-x-2 text-slate-700 dark:text-slate-300 font-medium">
                  <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span><strong>Warranty:</strong> 1-Year unconditional 1-to-1 over-the-counter swap</span>
                </div>
                <div className="flex items-center space-x-2 text-slate-700 dark:text-slate-300 font-medium">
                  <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span><strong>Customer Base:</strong> Premium phone buyers &amp; quality repeat customers</span>
                </div>
                <div className="flex items-center space-x-2 text-slate-700 dark:text-slate-300 font-medium">
                  <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span><strong>Marketing:</strong> Free acrylic counter stands, display dummies &amp; posters</span>
                </div>
              </div>
            </div>

            {/* Branch 2: Normal / Copy Compatible Dealership */}
            <div className="rounded-3xl border-2 border-amber-200 dark:border-amber-800/40 p-5 sm:p-6 bg-linear-to-b from-amber-50/50 to-transparent dark:from-amber-950/20 dark:to-transparent space-y-4">
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-600 text-white">
                  PATH B: NORMAL / COPY COMPATIBLE
                </span>
                <span className="text-xs font-bold text-amber-700 dark:text-amber-400">
                  400% to 700% Margin
                </span>
              </div>

              <div className="space-y-1">
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                  High-Turnover Daily Compatible Lots
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Universal high-volume daily counter drivers sold in bulk packs (e.g. ₹18 tempered glass, ₹19 cables).
                </p>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-white/10 text-xs">
                <div className="flex items-center space-x-2 text-slate-700 dark:text-slate-300 font-medium">
                  <Check className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span><strong>Packaging:</strong> Compact unbranded foam sleeves &amp; bulk blisters</span>
                </div>
                <div className="flex items-center space-x-2 text-slate-700 dark:text-slate-300 font-medium">
                  <Check className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span><strong>Warranty:</strong> 7-Day transit DOA defect testing guarantee</span>
                </div>
                <div className="flex items-center space-x-2 text-slate-700 dark:text-slate-300 font-medium">
                  <Check className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span><strong>Customer Base:</strong> High daily footfall repair &amp; quick budget counter sales</span>
                </div>
                <div className="flex items-center space-x-2 text-slate-700 dark:text-slate-300 font-medium">
                  <Check className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span><strong>Cash Velocity:</strong> Rotate inventory capital 4 to 6 times per month</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          3. THE TWO SHORT ARTICLES (BRANDED VS COPY DEALERSHIP)
          ══════════════════════════════════════════════════════════════════ */}
      <section className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Article 1: Branded Item Dealership */}
          <article className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-white/10 p-6 sm:p-8 shadow-xs flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-brand/10 dark:bg-orange-500/15 text-primary border border-brand/20 dark:border-orange-500/20">
                  {brandedArticle.badge}
                </span>
                <span className="text-[11px] font-bold text-slate-400">
                  Article 1 of 2
                </span>
              </div>

              <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                {brandedArticle.title}
              </h3>

              <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold leading-relaxed">
                {brandedArticle.short_summary}
              </p>

              <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed space-y-2 pt-2 border-t border-slate-100 dark:border-white/10">
                <p>{brandedArticle.content}</p>
              </div>

              <div className="space-y-1.5 pt-2">
                <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                  Key Branded Privileges:
                </p>
                {brandedArticle.key_points.map((pt, idx) => (
                  <div key={idx} className="flex items-start space-x-2 text-xs text-slate-700 dark:text-slate-200">
                    <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                    <span>{pt}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-white/10">
              <Link
                to="/dealers"
                className="inline-flex items-center space-x-1.5 text-xs font-black text-brand-dark dark:text-brand-light hover:underline"
              >
                <span>Apply for Branded Original Authorization</span>
                <ChevronRight className="w-3 h-3 stroke-[2.5]" />
              </Link>
            </div>
          </article>

          {/* Article 2: Normal / Copy Item Dealership */}
          <article className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-white/10 p-6 sm:p-8 shadow-xs flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40">
                  {copyArticle.badge}
                </span>
                <span className="text-[11px] font-bold text-slate-400">
                  Article 2 of 2
                </span>
              </div>

              <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                {copyArticle.title}
              </h3>

              <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold leading-relaxed">
                {copyArticle.short_summary}
              </p>

              <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed space-y-2 pt-2 border-t border-slate-100 dark:border-white/10">
                <p>{copyArticle.content}</p>
              </div>

              <div className="space-y-1.5 pt-2">
                <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                  Key Turnover Advantages:
                </p>
                {copyArticle.key_points.map((pt, idx) => (
                  <div key={idx} className="flex items-start space-x-2 text-xs text-slate-700 dark:text-slate-200">
                    <CheckCircle2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <span>{pt}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-white/10">
              <Link
                to="/dealers"
                className="inline-flex items-center space-x-1.5 text-xs font-black text-amber-700 dark:text-amber-400 hover:underline"
              >
                <span>Register for High-Volume Compatible Rates</span>
                <ChevronRight className="w-3 h-3 stroke-[2.5]" />
              </Link>
            </div>
          </article>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          4. VISUAL ITEM SHOWCASE (BRANDED VS COPY COMPARISON WITH IMAGES)
          ══════════════════════════════════════════════════════════════════ */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <span className="text-[11px] font-black uppercase tracking-widest text-brand-dark dark:text-brand-light">
              Visual Product Differentiation
            </span>
            <h2 className="text-xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              See The Difference in Detail: Branded vs Copy
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Inspect packaging, certified grades, and margin markups across real items
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex rounded-2xl bg-slate-100 dark:bg-slate-800 p-1 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setShowcaseFilter("all")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                showcaseFilter === "all"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs"
                  : "text-slate-600 dark:text-slate-400"
              }`}
            >
              All Items ({showcases.length})
            </button>
            <button
              type="button"
              onClick={() => setShowcaseFilter("branded")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                showcaseFilter === "branded"
                  ? "bg-brand-dark text-white shadow-2xs"
                  : "text-slate-600 dark:text-slate-400"
              }`}
            >
              Branded Gear
            </button>
            <button
              type="button"
              onClick={() => setShowcaseFilter("copy")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                showcaseFilter === "copy"
                  ? "bg-amber-600 text-white shadow-2xs"
                  : "text-slate-600 dark:text-slate-400"
              }`}
            >
              Normal / Copy
            </button>
          </div>
        </div>

        {/* Showcase Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredShowcases.map((card) => {
            const isBranded = card.item_type === "branded";

            return (
              <div
                key={card.id}
                className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-white/10 overflow-hidden shadow-xs flex flex-col justify-between group hover:shadow-md transition-shadow"
              >
                <div className="p-6 sm:p-7 space-y-5">
                  {/* Top Badge & Margin Highlight */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                        isBranded
                          ? "bg-cyan-50 dark:bg-orange-500/15 text-primary border-cyan-200 dark:border-orange-500/30"
                          : "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/40"
                      }`}
                    >
                      {isBranded ? "ORIGINAL BRANDED" : "COMPATIBLE COPY"}
                    </span>

                    <span className="text-xs font-black text-emerald-700 dark:text-emerald-400">
                      {card.dealer_margin}
                    </span>
                  </div>

                  {/* Photo & Header */}
                  <div className="flex items-start space-x-4">
                    <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-white/10 overflow-hidden shrink-0 flex items-center justify-center">
                      <img
                        src={card.image_url}
                        alt={card.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          // Fallback placeholder if image not found
                          (e.currentTarget as HTMLImageElement).src =
                            "/hero-accessories.jpg";
                        }}
                      />
                    </div>

                    <div className="space-y-1">
                      <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-tight">
                        {card.title}
                      </h3>
                      {card.subtitle && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                          {card.subtitle}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Specification Table */}
                  <div className="grid grid-cols-2 gap-2.5 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-white/5 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        Packaging
                      </span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {card.packaging_type}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        Warranty Swap
                      </span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {card.warranty_type}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        Internal Grade
                      </span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {card.quality_grade}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        Target Counter
                      </span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {card.target_customer}
                      </span>
                    </div>
                  </div>

                  {/* Feature Checkmarks */}
                  {card.features && card.features.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      {card.features.map((feat, idx) => (
                        <div
                          key={idx}
                          className="flex items-center space-x-2 text-xs text-slate-700 dark:text-slate-300"
                        >
                          <Check
                            className={`w-3.5 h-3.5 shrink-0 ${
                              isBranded
                                ? "text-primary"
                                : "text-amber-600 dark:text-amber-400"
                            }`}
                          />
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Bottom Order Link */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-white/10 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    MOQ: 10 units minimum lot
                  </span>
                  <Link
                    to="/dealers"
                    className="text-xs font-black text-brand-dark dark:text-brand-light hover:underline flex items-center space-x-1"
                  >
                    <span>Order Wholesale Lot</span>
                    <ChevronRight className="w-3 h-3 stroke-[2.5]" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          5. DYNAMIC CATEGORY PROFIT MARGINS TABLE
          ══════════════════════════════════════════════════════════════════ */}
      <section id="profit-breakdown" className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <span className="text-[11px] font-black uppercase tracking-widest text-brand-dark dark:text-brand-light">
              Live Database Margins
            </span>
            <h2 className="text-xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Wholesale Pricing &amp; Margin Potential
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Current depot buy costs vs recommended retail counter prices
            </p>
          </div>

          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Average 90%–140% Retail Markup</span>
          </span>
        </div>

        {/* Responsive Table Card */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-white/10 text-slate-500 dark:text-slate-400 font-black uppercase text-[10px] tracking-wider">
                  <th className="py-3.5 px-4 sm:px-6">Type &amp; Item Name</th>
                  <th className="py-3.5 px-3">Your Buy Cost</th>
                  <th className="py-3.5 px-3">Retail Sell Price</th>
                  <th className="py-3.5 px-3">Gross Margin</th>
                  <th className="py-3.5 px-4 sm:px-6">Profit Per Lot</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {margins.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="py-3.5 px-4 sm:px-6">
                      <div className="flex flex-col">
                        <div className="flex items-center space-x-2">
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase ${
                              item.item_type === "branded"
                                ? "bg-cyan-100 dark:bg-cyan-950/50 text-brand-dark dark:text-cyan-300"
                                : "bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300"
                            }`}
                          >
                            {item.item_type === "branded" ? "BRANDED" : "COPY"}
                          </span>
                          <span className="font-black text-slate-900 dark:text-white text-xs sm:text-sm">
                            {item.item_name}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2 mt-0.5">
                          <span className="text-[11px] text-slate-400 dark:text-slate-500">
                            Category: {item.category} • Lot: {item.lot_size}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-3 whitespace-nowrap">
                      <span className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
                        ₹{item.cost_price}
                      </span>
                      <span className="text-[10px] text-slate-400 block">/ piece</span>
                    </td>

                    <td className="py-3.5 px-3 whitespace-nowrap">
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {item.retail_price_range}
                      </span>
                      <span className="text-[10px] text-slate-400 block">counter MRP</span>
                    </td>

                    <td className="py-3.5 px-3 whitespace-nowrap">
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50">
                        {item.margin_percentage}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 sm:px-6 whitespace-nowrap">
                      <span className="font-black text-brand-dark dark:text-brand-light text-xs sm:text-sm">
                        {item.profit_per_lot}
                      </span>
                      <span className="text-[10px] text-slate-400 block">net gain</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          6. HOW THE DEALERSHIP WORKS (5-STEP PROCESS)
          ══════════════════════════════════════════════════════════════════ */}
      <section className="space-y-4">
        <div className="text-center max-w-xl mx-auto space-y-1">
          <span className="text-[11px] font-black uppercase tracking-widest text-brand-dark dark:text-brand-light">
            Simple 5-Step Execution
          </span>
          <h2 className="text-xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            How The Dealership Works
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            From quick KYC approval to receiving your doorstep consignment
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 pt-2">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-white/10 p-5 shadow-xs space-y-2">
            <span className="w-8 h-8 rounded-xl bg-brand/10 dark:bg-orange-500/15 text-primary font-black text-sm flex items-center justify-center">
              01
            </span>
            <h3 className="text-sm font-black text-slate-900 dark:text-white">
              4-Hour Verification
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Submit basic shop details or GSTIN. Get fast-tracked dealer approval in under 4 hours.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-white/10 p-5 shadow-xs space-y-2">
            <span className="w-8 h-8 rounded-xl bg-brand/10 dark:bg-orange-500/15 text-primary font-black text-sm flex items-center justify-center">
              02
            </span>
            <h3 className="text-sm font-black text-slate-900 dark:text-white">
              Unlock Depot Rates
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Your store app immediately flips to VIP Tier-1 wholesale rates across both branded and copy lines.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-white/10 p-5 shadow-xs space-y-2">
            <span className="w-8 h-8 rounded-xl bg-brand/10 dark:bg-orange-500/15 text-primary font-black text-sm flex items-center justify-center">
              03
            </span>
            <h3 className="text-sm font-black text-slate-900 dark:text-white">
              Flexible Lot Sizing
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Mix-and-match chargers, glass, and cables starting from 10 pieces with free delivery on ₹999+.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-white/10 p-5 shadow-xs space-y-2">
            <span className="w-8 h-8 rounded-xl bg-brand/10 dark:bg-orange-500/15 text-primary font-black text-sm flex items-center justify-center">
              04
            </span>
            <h3 className="text-sm font-black text-slate-900 dark:text-white">
              Same-Day Dispatch
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Consignments leave within 24 hours via SafeXpress and Delhivery air/surface cargo with live tracking.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-white/10 p-5 shadow-xs space-y-2">
            <span className="w-8 h-8 rounded-xl bg-brand/10 dark:bg-orange-500/15 text-primary font-black text-sm flex items-center justify-center">
              05
            </span>
            <h3 className="text-sm font-black text-slate-900 dark:text-white">
              Credit &amp; DOA Swap
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Enjoy 1-to-1 broken/transit swaps and unlock 15-to-30 day revolving credit terms as an active dealer.
            </p>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          7. DIFFERENTIATION TABLE: URT DEALER VS NORMAL PERSON (AT BOTTOM)
          ══════════════════════════════════════════════════════════════════ */}
      <section id="differentiation-table" className="space-y-5">
        <div className="text-center max-w-2xl mx-auto space-y-1">
          <span className="text-[11px] font-black uppercase tracking-widest text-brand-dark dark:text-brand-light">
            Comprehensive Privilege Comparison
          </span>
          <h2 className="text-xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            URT Authorized Dealer vs Normal Customer
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            See the exact operational, financial, and pricing benefits unlocked when you register as a dealer
          </p>
        </div>

        {/* Comparison Table */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200/80 dark:border-white/10">
                  <th className="py-4 px-4 sm:px-6 bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-black uppercase text-[10px] tracking-wider w-1/4">
                    Privilege / Feature
                  </th>
                  <th className="py-4 px-4 sm:px-6 bg-slate-100/70 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 font-black uppercase text-[10px] tracking-wider w-3/8">
                    Normal Customer / Person
                  </th>
                  <th className="py-4 px-4 sm:px-6 bg-cyan-50/80 dark:bg-orange-500/10 text-brand-dark dark:text-orange-300 font-black uppercase text-[10px] tracking-wider w-3/8 border-l border-cyan-100 dark:border-orange-500/20">
                    URT Authorized Dealer
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {benefits.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="py-4 px-4 sm:px-6 font-black text-slate-900 dark:text-white">
                      {b.feature_name}
                    </td>

                    <td className="py-4 px-4 sm:px-6 text-slate-600 dark:text-slate-400 leading-relaxed">
                      <div className="flex items-start space-x-2">
                        <X className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                        <span>{b.normal_person_benefit}</span>
                      </div>
                    </td>

                    <td className="py-4 px-4 sm:px-6 font-bold text-slate-900 dark:text-white leading-relaxed bg-cyan-50/30 dark:bg-orange-500/5 border-l border-cyan-100 dark:border-orange-500/20">
                      <div className="flex items-start space-x-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        <span>{b.urt_dealer_benefit}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <span className="text-slate-500 dark:text-slate-400">
              * Verification is completely free of charge. No registration or deposit fees.
            </span>
            <Link
              to="/dealers"
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-on-primary bg-primary hover:bg-primary-hover active:bg-primary-active shadow-xs transition"
            >
              <span>Unlock Dealer Benefits Today</span>
              <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
            </Link>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          8. FREQUENTLY ASKED QUESTIONS (FAQS)
          ══════════════════════════════════════════════════════════════════ */}
      <section className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-white/10 p-6 sm:p-10 shadow-xs space-y-5">
        <div className="text-center max-w-xl mx-auto space-y-1">
          <span className="text-[11px] font-black uppercase tracking-widest text-brand-dark dark:text-brand-light">
            Clear Answers
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Dealership FAQs
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Frequently asked questions on verification, MOQs, warranty swaps, and credit lines
          </p>
        </div>

        <div className="max-w-3xl mx-auto divide-y divide-slate-100 dark:divide-white/10">
          {FAQ_ITEMS.map((faq, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div key={idx} className="py-3 sm:py-4">
                <button
                  type="button"
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="w-full flex items-center justify-between text-left py-1 cursor-pointer group"
                >
                  <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white group-hover:text-brand-dark dark:group-hover:text-brand-light transition">
                    {faq.q}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ml-3 ${
                      isOpen ? "rotate-180 text-brand-dark dark:text-brand-light" : ""
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="pt-2 pb-1 text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-normal animate-in fade-in duration-150">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          9. BOTTOM CTA BAR
          ══════════════════════════════════════════════════════════════════ */}
      <section className="bg-linear-to-r from-brand-dark via-brand to-cyan-500 text-white rounded-3xl p-6 sm:p-10 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="space-y-1.5 max-w-lg">
          <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/20 text-white">
            Fast 4-Hour Approval
          </span>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight">
            Ready to Multiply Your Counter Margins?
          </h2>
          <p className="text-xs sm:text-sm text-cyan-100 leading-relaxed">
            Submit your store details in 3 minutes. Unlock Tier-1 factory prices, branded display
            kits, and same-day express dispatch.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
          <Link
            to="/dealers"
            onClick={() => triggerHaptic("selection")}
            className="inline-flex items-center justify-center space-x-2 px-6 py-3.5 rounded-2xl bg-white text-slate-900 font-black text-xs sm:text-sm shadow-md hover:bg-slate-50 active:scale-95 transition text-center"
          >
            <span>Start Dealer Application</span>
            <ArrowRight className="w-4 h-4 stroke-[2.5]" />
          </Link>

          {whatsappNumber && (
            <a
              href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
                "Hello URT Wholesale, I want to discuss opening an authorized dealership for my retail store."
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center space-x-1.5 px-4 py-3.5 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-xs transition text-center"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Ask a Question</span>
            </a>
          )}
        </div>
      </section>
    </div>
  );
}
