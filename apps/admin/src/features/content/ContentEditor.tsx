import { useState, useEffect, useCallback } from "react";
import {
  fetchBanners,
  saveBanner,
  createBanner,
  deleteBanner,
  fetchStorePages,
  saveStorePage,
  fetchStoreSettings,
  updateStoreSetting,
  uploadBannerImage,
  fetchTopZeroResultSearches,
  addSearchSynonym,
  refreshSearchVocabulary,
  fetchBestsellerProducts,
  toggleProductBestseller,
  searchProductsForBestseller,
  fetchCategories,
  fetchProductsPage,
  type ZeroResultSearchRecord,
} from "../../lib/adminService";
import type { Banner, StorePage, Product, Category } from "@urbanrat/shared";
import { getCategoryVisualPath } from "@urbanrat/shared";
import {
  Image as ImageIcon,
  FileText,
  Search,
  Save,
  Check,
  Plus,
  Trash2,
  Loader2,
  Upload,
  ExternalLink,
  Zap,
  RefreshCw,
  Sparkles,
  Star,
  Award,
  X,
  Sliders,
} from "lucide-react";
import { ImageCompressorTool } from "./ImageCompressorTool";
import { MarqueeManager } from "./MarqueeManager";
import { DealershipManager } from "../dealership/DealershipManager";

export function ContentEditor() {
  const [subTab, setSubTab] = useState<
    "banners" | "marquee" | "dealership" | "pages" | "searches" | "compressor" | "bestsellers"
  >("banners");

  // 1. Banners state
  const [banners, setBanners] = useState<Banner[]>([]);
  const [bannerPlacement, setBannerPlacement] = useState<"all" | "home_hero" | "home_brand" | "urbanrat_hero">("all");
  const [savingBannerId, setSavingBannerId] = useState<string | null>(null);
  const [creatingBanner, setCreatingBanner] = useState(false);
  const [deletingBannerId, setDeletingBannerId] = useState<string | null>(null);
  const [uploadingBannerId, setUploadingBannerId] = useState<string | null>(null);

  // 2. Pages state
  const [pages, setPages] = useState<StorePage[]>([]);
  const [selectedPageSlug, setSelectedPageSlug] = useState<string>("about");
  const [savingPage, setSavingPage] = useState(false);

  // 3. Popular Searches state
  const [popularSearches, setPopularSearches] = useState<string[]>([]);
  const [newSearchQuery, setNewSearchQuery] = useState("");
  const [savingSearches, setSavingSearches] = useState(false);

  // 4. Search Insights & Synonyms state
  const [searchInsightsDays, setSearchInsightsDays] = useState<number>(7);
  const [zeroResultSearches, setZeroResultSearches] = useState<ZeroResultSearchRecord[]>([]);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [refreshingVocab, setRefreshingVocab] = useState(false);
  const [activeSynonymQuery, setActiveSynonymQuery] = useState<string | null>(null);
  const [synonymInput, setSynonymInput] = useState<string>("");
  const [savingSynonym, setSavingSynonym] = useState(false);

  // 5. Home Bestsellers Curation state
  const [bestsellers, setBestsellers] = useState<Product[]>([]);
  const [loadingBestsellers, setLoadingBestsellers] = useState(false);
  const [bestsellerSearchQuery, setBestsellerSearchQuery] = useState("");
  const [bestsellerSearchResults, setBestsellerSearchResults] = useState<Product[]>([]);
  const [isSearchingBestsellers, setIsSearchingBestsellers] = useState(false);
  const [togglingBestsellerId, setTogglingBestsellerId] = useState<string | null>(null);

  // 6. Category linking & visual picker state
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryByBanner, setSelectedCategoryByBanner] = useState<Record<string, string>>({});
  const [categoryProductPicker, setCategoryProductPicker] = useState<{
    bannerId: string;
    categorySlug: string;
    categoryName: string;
    products: Product[];
    loading: boolean;
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function showToast(msg: string) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  }

  function extractCategorySlug(ctaLink?: string | null): string {
    if (!ctaLink) return "";
    const match = ctaLink.match(/[?&]category=([a-zA-Z0-9_-]+)/);
    return match && match[1] ? match[1] : "";
  }

  async function loadCategoryProducts(bannerId: string, categorySlug: string) {
    const cat = categories.find((c) => c.slug === categorySlug);
    if (!cat) return;
    setCategoryProductPicker({
      bannerId,
      categorySlug,
      categoryName: cat.name,
      products: [],
      loading: true,
    });

    try {
      const res = await fetchProductsPage({ categoryId: cat.id, pageSize: 12 });
      setCategoryProductPicker({
        bannerId,
        categorySlug,
        categoryName: cat.name,
        products: res.products || [],
        loading: false,
      });
    } catch (err) {
      console.warn("Failed to load products for category:", err);
      setCategoryProductPicker((prev) => (prev ? { ...prev, loading: false } : null));
    }
  }

  function handleSelectProductImageForBanner(bannerId: string, product: Product) {
    const img = product.images?.[0] || "";
    if (img) {
      handleBannerChange(bannerId, "image_url", img);
      const b = banners.find((x) => x.id === bannerId);
      if (b && !b.subtitle) {
        handleBannerChange(bannerId, "subtitle", `Wholesale from ₹${product.price} • MOQ: ${product.min_order_qty || 1} pcs`);
      }
      showToast(`Linked image from "${product.name}" to banner!`);
    }
  }

  const loadBestsellers = useCallback(async () => {
    setLoadingBestsellers(true);
    try {
      const data = await fetchBestsellerProducts();
      setBestsellers(data);
    } catch (err: any) {
      console.warn("Failed to load bestsellers:", err);
    } finally {
      setLoadingBestsellers(false);
    }
  }, []);

  const loadAllContent = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [bannersData, pagesData, settingsData, bestsellersData, categoriesData] = await Promise.all([
        fetchBanners(),
        fetchStorePages(),
        fetchStoreSettings(),
        fetchBestsellerProducts().catch(() => [] as Product[]),
        fetchCategories().catch(() => [] as Category[]),
      ]);

      setBanners(bannersData);
      setPages(pagesData);
      setPopularSearches(settingsData.popular_searches || []);
      setBestsellers(bestsellersData);
      setCategories(categoriesData.filter((c) => c.is_active));
    } catch (err: any) {
      console.error("Failed to load content management data:", err);
      setError(err?.message || "Failed to load content records.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllContent();
  }, [loadAllContent]);

  // Debounced search for products to add to bestsellers
  useEffect(() => {
    if (!bestsellerSearchQuery.trim()) {
      setBestsellerSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearchingBestsellers(true);
      try {
        const exclude = bestsellers.map((b) => b.id);
        const results = await searchProductsForBestseller(bestsellerSearchQuery, exclude);
        setBestsellerSearchResults(results);
      } catch (err) {
        console.warn("Error searching products for bestsellers:", err);
      } finally {
        setIsSearchingBestsellers(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [bestsellerSearchQuery, bestsellers]);

  async function handleAddBestseller(product: Product) {
    setTogglingBestsellerId(product.id);
    try {
      await toggleProductBestseller(product.id, true);
      const updated = { ...product, is_featured: true };
      setBestsellers((prev) => [updated, ...prev]);
      setBestsellerSearchResults((prev) => prev.filter((p) => p.id !== product.id));
      showToast(`Added "${product.name}" to Home Bestsellers!`);
    } catch (err: any) {
      setError(err?.message || "Failed to add product to bestsellers.");
    } finally {
      setTogglingBestsellerId(null);
    }
  }

  async function handleRemoveBestseller(product: Product) {
    setTogglingBestsellerId(product.id);
    try {
      await toggleProductBestseller(product.id, false);
      setBestsellers((prev) => prev.filter((p) => p.id !== product.id));
      showToast(`Removed "${product.name}" from Home Bestsellers.`);
    } catch (err: any) {
      setError(err?.message || "Failed to remove product from bestsellers.");
    } finally {
      setTogglingBestsellerId(null);
    }
  }

  // Banner modification
  function handleBannerChange(id: string, field: keyof Banner, val: any) {
    setBanners((prev) =>
      prev.map((b) => (b.id === id ? { ...b, [field]: val } : b))
    );
  }

  async function handleBannerImageUpload(bannerId: string, file: File) {
    setUploadingBannerId(bannerId);
    setError(null);
    try {
      let statsMsg = "Banner image uploaded & optimized successfully!";
      const publicUrl = await uploadBannerImage(file, (stats) => {
        if (stats.savingsPercent > 0) {
          statsMsg = `⚡ Compressed ${stats.formattedOriginalSize} → ${stats.formattedCompressedSize} (${stats.savingsPercent}% smaller)!`;
        }
      });
      handleBannerChange(bannerId, "image_url", publicUrl);
      showToast(statsMsg);
    } catch (err: any) {
      console.error("Banner image upload error:", err);
      setError(err?.message || "Failed to upload banner image to Supabase storage.");
    } finally {
      setUploadingBannerId(null);
    }
  }

  async function handleCreateBanner() {
    setCreatingBanner(true);
    setError(null);
    try {
      const targetPlacement = bannerPlacement === "all" ? "home_hero" : bannerPlacement;
      const created = await createBanner({
        placement: targetPlacement,
        title: "Urbanrat 65W GaN Pro",
        subtitle: "Wholesale Deal: ₹340 / pc • Min 5 pcs",
        badge_text: "URBANRAT PRO",
        rating: "4.9",
        image_url:
          "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=800&q=80&auto=format&fit=crop",
        cta_text: "Receive",
        cta_link: "/urbanrat",
        sort_order: banners.length,
        is_active: true,
      });
      setBanners((prev) => [created, ...prev]);
      showToast("✨ New hero offer card added! Edit details and save.");
    } catch (err: any) {
      console.error("Failed to create banner:", err);
      setError(err?.message || "Failed to create banner.");
    } finally {
      setCreatingBanner(false);
    }
  }

  async function handleDeleteBanner(id: string) {
    if (!window.confirm("Are you sure you want to delete this offer card?")) return;
    setDeletingBannerId(id);
    setError(null);
    try {
      await deleteBanner(id);
      setBanners((prev) => prev.filter((b) => b.id !== id));
      showToast("Offer card deleted.");
    } catch (err: any) {
      console.error("Failed to delete banner:", err);
      setError(err?.message || "Failed to delete banner.");
    } finally {
      setDeletingBannerId(null);
    }
  }

  async function handleSaveBanner(b: Banner) {
    setSavingBannerId(b.id);
    setError(null);
    try {
      await saveBanner({
        id: b.id,
        title: b.title,
        subtitle: b.subtitle,
        badge_text: b.badge_text,
        rating: b.rating || "4.9",
        image_url: b.image_url,
        badges: b.badges,
        cta_text: b.cta_text,
        cta_link: b.cta_link,
        secondary_cta_text: b.secondary_cta_text,
        secondary_cta_link: b.secondary_cta_link,
        placement: b.placement,
        sort_order: b.sort_order,
        is_active: b.is_active,
      });
      showToast(`Offer card "${b.title || b.placement}" updated!`);
    } catch (err: any) {
      console.error("Banner save error:", err);
      setError(err?.message || "Failed to save banner.");
    } finally {
      setSavingBannerId(null);
    }
  }

  // Page modification
  const activePage = pages.find((p) => p.slug === selectedPageSlug);

  function handleActivePageChange(field: keyof StorePage, val: string) {
    setPages((prev) =>
      prev.map((p) => (p.slug === selectedPageSlug ? { ...p, [field]: val } : p))
    );
  }

  async function handleSaveActivePage() {
    if (!activePage) return;
    setSavingPage(true);
    setError(null);
    try {
      await saveStorePage({
        slug: activePage.slug,
        title: activePage.title,
        summary: activePage.summary,
        content: activePage.content,
      });
      showToast(`Page "${activePage.title}" saved!`);
    } catch (err: any) {
      console.error("Page save error:", err);
      setError(err?.message || "Failed to save policy page.");
    } finally {
      setSavingPage(false);
    }
  }

  // Searches modification
  function handleAddSearch() {
    if (!newSearchQuery.trim()) return;
    const clean = newSearchQuery.trim();
    if (!popularSearches.includes(clean)) {
      setPopularSearches((prev) => [...prev, clean]);
    }
    setNewSearchQuery("");
  }

  function handleRemoveSearch(tag: string) {
    setPopularSearches((prev) => prev.filter((s) => s !== tag));
  }

  async function handleSaveSearches() {
    setSavingSearches(true);
    setError(null);
    try {
      await updateStoreSetting("popular_searches", popularSearches);
      showToast("Popular searches updated!");
    } catch (err: any) {
      console.error("Popular searches save error:", err);
      setError(err?.message || "Failed to update popular searches.");
    } finally {
      setSavingSearches(false);
    }
  }

  const loadSearchInsights = useCallback(async (days: number) => {
    setLoadingInsights(true);
    try {
      const records = await fetchTopZeroResultSearches(days);
      setZeroResultSearches(records);
    } catch (err: any) {
      console.warn("Error loading zero result searches:", err);
    } finally {
      setLoadingInsights(false);
    }
  }, []);

  useEffect(() => {
    if (subTab === "searches") {
      loadSearchInsights(searchInsightsDays);
    }
  }, [subTab, searchInsightsDays, loadSearchInsights]);

  async function handleRefreshVocab() {
    setRefreshingVocab(true);
    setError(null);
    try {
      const count = await refreshSearchVocabulary();
      showToast(`Harvested ${count} search vocabulary tokens successfully!`);
    } catch (err: any) {
      setError(err?.message || "Failed to refresh search vocabulary.");
    } finally {
      setRefreshingVocab(false);
    }
  }

  async function handleSaveSynonym(term: string) {
    if (!synonymInput.trim()) return;
    setSavingSynonym(true);
    setError(null);
    try {
      const synArray = synonymInput
        .split(/[,;]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      await addSearchSynonym(term, synArray);
      showToast(`Synonyms saved for "${term}"!`);
      setActiveSynonymQuery(null);
      setSynonymInput("");
      loadSearchInsights(searchInsightsDays);
    } catch (err: any) {
      setError(err?.message || "Failed to save synonym.");
    } finally {
      setSavingSynonym(false);
    }
  }

  const filteredBanners =
    bannerPlacement === "all"
      ? banners
      : banners.filter((b) => b.placement === bannerPlacement);

  return (
    <div className="space-y-6">
      {/* ── Top Header with Sub-tabs ── */}
      <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
              Store Content Management
            </h2>
            <p className="text-xs text-slate-400">
              Edit promotional banners by placement, legal store pages, and popular searches
            </p>
          </div>

          {toastMessage && (
            <span className="self-start sm:self-auto inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
              <Check className="w-3.5 h-3.5" />
              <span>{toastMessage}</span>
            </span>
          )}
        </div>

        {/* Sub-Tabs Selector */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setSubTab("banners")}
            className={`inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              subTab === "banners"
                ? "bg-brand-dark text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Promotional Banners ({banners.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab("marquee")}
            className={`inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              subTab === "marquee"
                ? "bg-brand-dark text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Marquee Announcements</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab("dealership")}
            className={`inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              subTab === "dealership"
                ? "bg-brand-dark text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            <span>Dealership Program</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab("pages")}
            className={`inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              subTab === "pages"
                ? "bg-brand-dark text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Store Pages &amp; Policies ({pages.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab("searches")}
            className={`inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              subTab === "searches"
                ? "bg-brand-dark text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Popular Searches ({popularSearches.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab("compressor")}
            className={`inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              subTab === "compressor"
                ? "bg-brand-dark text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Image Compressor Tool</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab("bestsellers")}
            className={`inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              subTab === "bestsellers"
                ? "bg-amber-500 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            <span>Home Bestsellers ({bestsellers.length})</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
          {error}
        </div>
      )}

      {loading ? (
        <div className="bg-white p-12 rounded-3xl border border-slate-100 text-center text-xs text-slate-400 flex items-center justify-center space-x-2">
          <Loader2 className="w-5 h-5 animate-spin text-brand-dark" />
          <span>Loading content configuration from Supabase...</span>
        </div>
      ) : (
        <>
          {/* ══════════════════════════════════════════════════════════════════
              SUB-TAB 1: BANNERS BY PLACEMENT
             ══════════════════════════════════════════════════════════════════ */}
          {subTab === "banners" && (
            <div className="space-y-4">
              {/* Placement Filter & Add Button */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-100 text-xs font-semibold">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-slate-400 mr-1">Filter Placement:</span>
                  {(["all", "home_hero", "home_brand", "urbanrat_hero"] as const).map(
                    (pl) => (
                      <button
                        key={pl}
                        type="button"
                        onClick={() => setBannerPlacement(pl)}
                        className={`px-3 py-1 rounded-xl transition cursor-pointer ${
                          bannerPlacement === pl
                            ? "bg-brand-dark text-white font-bold"
                            : "text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        {pl === "all"
                          ? "All Placements"
                          : pl === "home_hero"
                          ? "Home Hero (Stacked Carousel)"
                          : pl === "home_brand"
                          ? "Brand Spotlight"
                          : "Urbanrat Brand Hero"}
                      </button>
                    )
                  )}
                </div>

                <button
                  type="button"
                  disabled={creatingBanner}
                  onClick={handleCreateBanner}
                  className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-white text-xs font-bold shadow-xs active:scale-95 transition cursor-pointer hover:opacity-95 disabled:opacity-50"
                  style={{
                    background: "linear-gradient(to bottom, #5ADBE5, #0A82A8)",
                  }}
                >
                  {creatingBanner ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                  <span>+ Add New Offer Card</span>
                </button>
              </div>

              {/* Banners List */}
              <div className="space-y-5">
                {filteredBanners.map((b) => {
                  const activeCatSlug = selectedCategoryByBanner[b.id] || extractCategorySlug(b.cta_link) || "";
                  const activeCat = categories.find((c) => c.slug === activeCatSlug);

                  return (
                  <div
                    key={b.id}
                    className="bg-white rounded-3xl border border-slate-100 p-5 sm:p-6 shadow-xs space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                      <div>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-cyan-50 text-brand-dark border border-cyan-200">
                          {b.placement}
                        </span>
                        <h3 className="text-sm font-black text-slate-900 mt-1">
                          {b.title}
                        </h3>
                      </div>

                      <div className="flex items-center space-x-2.5">
                        <label className="flex items-center space-x-1.5 text-xs font-bold text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={b.is_active}
                            onChange={(e) =>
                              handleBannerChange(b.id, "is_active", e.target.checked)
                            }
                            className="rounded text-brand-dark focus:ring-brand-light"
                          />
                          <span>Active</span>
                        </label>

                        <button
                          type="button"
                          disabled={savingBannerId === b.id}
                          onClick={() => handleSaveBanner(b)}
                          className="px-4 py-1.5 rounded-xl text-white text-xs font-bold shadow transition active:scale-95 disabled:opacity-50 cursor-pointer flex items-center space-x-1.5"
                          style={{
                            background: "linear-gradient(to bottom, #5ADBE5, #0A82A8)",
                          }}
                        >
                          {savingBannerId === b.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Save className="w-3.5 h-3.5" />
                          )}
                          <span>Save</span>
                        </button>

                        <button
                          type="button"
                          disabled={deletingBannerId === b.id}
                          onClick={() => handleDeleteBanner(b.id)}
                          className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                          title="Delete offer card"
                        >
                          {deletingBannerId === b.id ? (
                            <Loader2 className="w-4 h-4 animate-spin text-rose-500" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                      <div className="space-y-1 sm:col-span-3">
                        <label className="font-bold text-slate-700">Card / Offer Title</label>
                        <input
                          type="text"
                          value={b.title}
                          onChange={(e) =>
                            handleBannerChange(b.id, "title", e.target.value)
                          }
                          placeholder="e.g. Urbanrat 65W GaN Pro"
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-light font-bold"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="font-bold text-slate-700">Top Tag / Badge Text</label>
                        <input
                          type="text"
                          value={b.badge_text || ""}
                          onChange={(e) =>
                            handleBannerChange(b.id, "badge_text", e.target.value)
                          }
                          placeholder="e.g. URBANRAT PRO"
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-light"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="font-bold text-slate-700 flex items-center space-x-1">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                          <span>Custom Rating (e.g. 4.9)</span>
                        </label>
                        <input
                          type="text"
                          value={b.rating || (b.badges?.find((x) => x.icon === "Star")?.text) || "4.9"}
                          onChange={(e) =>
                            handleBannerChange(b.id, "rating", e.target.value)
                          }
                          placeholder="4.9"
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-light font-bold"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="font-bold text-slate-700">Display Order</label>
                        <input
                          type="number"
                          value={b.sort_order ?? 0}
                          onChange={(e) =>
                            handleBannerChange(b.id, "sort_order", parseInt(e.target.value) || 0)
                          }
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-light"
                        />
                      </div>

                      <div className="space-y-1 sm:col-span-3">
                        <label className="font-bold text-slate-700">Placement</label>
                        <select
                          value={b.placement}
                          onChange={(e) =>
                            handleBannerChange(b.id, "placement", e.target.value)
                          }
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-light bg-white"
                        >
                          <option value="home_hero">Home Hero (3D Stacked Carousel)</option>
                          <option value="home_brand">Brand Spotlight</option>
                          <option value="urbanrat_hero">Urbanrat Brand Hero</option>
                        </select>
                      </div>

                      <div className="space-y-2 sm:col-span-3 p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/80">
                        <div className="flex items-center justify-between">
                          <label className="font-bold text-slate-800 flex items-center space-x-1.5">
                            <ImageIcon className="w-4 h-4 text-brand-dark" />
                            <span>Hero / Promotional Banner Image</span>
                          </label>
                          {b.image_url && (
                            <button
                              type="button"
                              onClick={() => handleBannerChange(b.id, "image_url", "")}
                              className="text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:underline flex items-center space-x-1 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Remove Image</span>
                            </button>
                          )}
                        </div>

                        {b.image_url ? (
                          <div className="flex flex-col sm:flex-row gap-4 items-start">
                            <div className={`relative rounded-xl overflow-hidden border border-slate-200 bg-white shadow-2xs group shrink-0 w-full sm:w-60 ${b.placement === "home_hero" ? "aspect-5/4" : "aspect-video"}`}>
                              <img
                                src={b.image_url}
                                alt={b.title || "Banner preview"}
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                <a
                                  href={b.image_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1.5 rounded-lg bg-white/90 text-slate-700 hover:text-slate-900 shadow-xs"
                                  title="View full image"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                                <button
                                  type="button"
                                  onClick={() => handleBannerChange(b.id, "image_url", "")}
                                  className="p-1.5 rounded-lg bg-rose-600 text-white shadow-xs hover:bg-rose-700"
                                  title="Remove image"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            <div className="flex-1 space-y-2 w-full">
                              <div className="flex flex-wrap items-center gap-2">
                                <label className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 shadow-2xs cursor-pointer transition">
                                  {uploadingBannerId === b.id ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-dark" />
                                  ) : (
                                    <Upload className="w-3.5 h-3.5 text-brand-dark" />
                                  )}
                                  <span>{uploadingBannerId === b.id ? "Uploading..." : "Replace / Upload New Image"}</span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    disabled={uploadingBannerId === b.id}
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) handleBannerImageUpload(b.id, file);
                                    }}
                                    className="hidden"
                                  />
                                </label>
                              </div>

                              <div className="space-y-1">
                                <span className="text-[11px] text-slate-400 font-medium">Or change image URL directly:</span>
                                <input
                                  type="text"
                                  value={b.image_url || ""}
                                  onChange={(e) =>
                                    handleBannerChange(b.id, "image_url", e.target.value)
                                  }
                                  placeholder="https://..."
                                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-brand-light bg-white"
                                />
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="p-4 rounded-xl border-2 border-dashed border-slate-200 bg-white flex flex-col sm:flex-row items-center justify-between gap-3">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 rounded-xl bg-brand-light/10 flex items-center justify-center text-brand-dark">
                                <ImageIcon className="w-5 h-5" />
                              </div>
                              <div>
                                <p className="text-xs font-bold text-slate-800">No Image Attached</p>
                                <p className="text-[11px] text-slate-400">Upload high-res banner for hero/brand promotion</p>
                              </div>
                            </div>

                            <div className="flex items-center space-x-2 w-full sm:w-auto">
                              <label
                                className="flex-1 sm:flex-initial inline-flex items-center justify-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white shadow-xs cursor-pointer transition hover:opacity-90"
                                style={{ background: "linear-gradient(to bottom, #5ADBE5, #0A82A8)" }}
                              >
                                {uploadingBannerId === b.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Upload className="w-3.5 h-3.5" />
                                )}
                                <span>{uploadingBannerId === b.id ? "Uploading..." : "Upload Banner Image"}</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  disabled={uploadingBannerId === b.id}
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleBannerImageUpload(b.id, file);
                                  }}
                                  className="hidden"
                                />
                              </label>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* ── Category Quick Link & Image Picker ── */}
                      <div className="sm:col-span-3 p-4 rounded-2xl bg-cyan-50/60 border border-cyan-100/90 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center space-x-2">
                            <div className="p-1.5 rounded-lg bg-brand-light/20 text-brand-dark">
                              <Sliders className="w-4 h-4" />
                            </div>
                            <div>
                              <span className="text-xs font-bold text-slate-900">
                                Link Hero to Specific Category
                              </span>
                              <p className="text-[11px] text-slate-500">
                                Route this banner to a wholesale category route &amp; link official category visuals
                              </p>
                            </div>
                          </div>

                          {activeCat && (
                            <div className="flex items-center space-x-2">
                              <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-brand-dark text-white shadow-2xs">
                                <span>🎯 Active Link: {activeCat.name}</span>
                              </span>
                              <a
                                href={`/marketplace?category=${activeCat.slug}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[11px] font-bold text-brand-dark hover:underline flex items-center space-x-0.5"
                              >
                                <span>Preview Route</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                          <div className="sm:col-span-5 space-y-1">
                            <label className="text-[11px] font-bold text-slate-700">
                              Target Category
                            </label>
                            <select
                              value={activeCatSlug}
                              onChange={(e) => {
                                const slug = e.target.value;
                                setSelectedCategoryByBanner((prev) => ({ ...prev, [b.id]: slug }));
                                if (slug) {
                                  const cat = categories.find((c) => c.slug === slug);
                                  handleBannerChange(b.id, "cta_link", `/marketplace?category=${slug}`);
                                  if (!b.cta_text || b.cta_text === "Receive") {
                                    handleBannerChange(b.id, "cta_text", `Shop ${cat?.name || "Category"}`);
                                  }
                                }
                              }}
                              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-light cursor-pointer"
                            >
                              <option value="">-- No Category Link (Custom URL) --</option>
                              {categories.map((c) => (
                                <option key={c.id} value={c.slug}>
                                  {c.name} ({c.slug})
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="sm:col-span-7 space-y-1">
                            <label className="text-[11px] font-bold text-slate-700">
                              Category Visuals &amp; Products
                            </label>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <button
                                type="button"
                                disabled={!activeCatSlug}
                                onClick={() => {
                                  if (activeCatSlug) {
                                    const darkImg = getCategoryVisualPath(activeCatSlug, "dark");
                                    handleBannerChange(b.id, "image_url", darkImg);
                                    showToast(`Applied Dark 3D visual for ${activeCat?.name || activeCatSlug}!`);
                                  }
                                }}
                                className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 transition disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs cursor-pointer"
                                title="Use official dark obsidian 3D tech render for this category"
                              >
                                <span>🌙 Dark Visual</span>
                              </button>

                              <button
                                type="button"
                                disabled={!activeCatSlug}
                                onClick={() => {
                                  if (activeCatSlug) {
                                    const lightImg = getCategoryVisualPath(activeCatSlug, "light");
                                    handleBannerChange(b.id, "image_url", lightImg);
                                    showToast(`Applied Light Studio visual for ${activeCat?.name || activeCatSlug}!`);
                                  }
                                }}
                                className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-white border border-slate-200 text-slate-800 hover:bg-slate-50 transition disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs cursor-pointer"
                                title="Use clean light studio 3D render for this category"
                              >
                                <span>☀️ Light Visual</span>
                              </button>

                              <button
                                type="button"
                                disabled={!activeCatSlug}
                                onClick={() => loadCategoryProducts(b.id, activeCatSlug)}
                                className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-brand-light/20 text-brand-dark border border-brand-light/30 hover:bg-brand-light/30 transition disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs cursor-pointer"
                                title="Browse product hero images from this category"
                              >
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>Pick from Products</span>
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Expandable Category Products Picker Grid */}
                        {categoryProductPicker && categoryProductPicker.bannerId === b.id && (
                          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs space-y-2 mt-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                                <Sparkles className="w-3.5 h-3.5 text-brand-dark" />
                                <span>
                                  Select a product image from {categoryProductPicker.categoryName} ({categoryProductPicker.products.length} products)
                                </span>
                              </span>
                              <button
                                type="button"
                                onClick={() => setCategoryProductPicker(null)}
                                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>

                            {categoryProductPicker.loading ? (
                              <div className="flex items-center justify-center py-6 space-x-2 text-slate-400 text-xs">
                                <Loader2 className="w-4 h-4 animate-spin text-brand-dark" />
                                <span>Loading category products...</span>
                              </div>
                            ) : categoryProductPicker.products.length === 0 ? (
                              <p className="text-xs text-slate-400 py-3 text-center">
                                No products found in this category.
                              </p>
                            ) : (
                              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 max-h-56 overflow-y-auto p-1">
                                {categoryProductPicker.products.map((prod) => {
                                  const img = prod.images?.[0] || "";
                                  if (!img) return null;
                                  return (
                                    <button
                                      key={prod.id}
                                      type="button"
                                      onClick={() => handleSelectProductImageForBanner(b.id, prod)}
                                      className="group text-left p-1.5 rounded-xl border border-slate-200 hover:border-brand-dark hover:ring-2 hover:ring-brand-light/30 transition bg-slate-50 hover:bg-white cursor-pointer"
                                    >
                                      <div className="w-full aspect-square rounded-lg overflow-hidden bg-slate-100 mb-1">
                                        <img
                                          src={img}
                                          alt={prod.name}
                                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                        />
                                      </div>
                                      <p className="text-[10px] font-bold text-slate-800 truncate">
                                        {prod.name}
                                      </p>
                                      <p className="text-[9px] text-brand-dark font-black">
                                        ₹{prod.price}
                                      </p>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="space-y-1 sm:col-span-3">
                        <label className="font-bold text-slate-700">Subtitle / Wholesale Deal Description</label>
                        <textarea
                          rows={2}
                          value={b.subtitle || ""}
                          onChange={(e) =>
                            handleBannerChange(b.id, "subtitle", e.target.value)
                          }
                          placeholder="e.g. Wholesale Deal: ₹340 / pc • Min 5 pcs"
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-light"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="font-bold text-slate-700">Action Button Text</label>
                        <input
                          type="text"
                          value={b.cta_text || ""}
                          onChange={(e) =>
                            handleBannerChange(b.id, "cta_text", e.target.value)
                          }
                          placeholder="Receive"
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-light font-bold"
                        />
                      </div>

                      <div className="space-y-1 sm:col-span-2">
                        <label className="font-bold text-slate-700">Action Button Link</label>
                        <input
                          type="text"
                          value={b.cta_link || ""}
                          onChange={(e) =>
                            handleBannerChange(b.id, "cta_link", e.target.value)
                          }
                          placeholder="/urbanrat or /marketplace"
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-light font-mono text-xs"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              SUB-TAB 1.5: MARQUEE ANNOUNCEMENTS & OFFERS TICKER
             ══════════════════════════════════════════════════════════════════ */}
          {subTab === "marquee" && <MarqueeManager />}

          {/* ══════════════════════════════════════════════════════════════════
              SUB-TAB 1.6: DEALERSHIP PROGRAM, MARGINS & BRANDED VS COPY
             ══════════════════════════════════════════════════════════════════ */}
          {subTab === "dealership" && <DealershipManager />}

          {/* ══════════════════════════════════════════════════════════════════
              SUB-TAB 2: STORE PAGES (About, Terms, Privacy)
             ══════════════════════════════════════════════════════════════════ */}
          {subTab === "pages" && (
            <div className="bg-white rounded-3xl border border-slate-100 p-5 sm:p-6 shadow-xs space-y-6">
              {/* Page Selector Tabs */}
              <div className="flex space-x-2 border-b border-slate-100 pb-3">
                {pages.map((p) => (
                  <button
                    key={p.slug}
                    type="button"
                    onClick={() => setSelectedPageSlug(p.slug)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                      selectedPageSlug === p.slug
                        ? "bg-brand-dark text-white shadow-xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {p.title}
                  </button>
                ))}
              </div>

              {activePage ? (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Page Title</label>
                    <input
                      type="text"
                      value={activePage.title}
                      onChange={(e) => handleActivePageChange("title", e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand-light"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">
                      Summary Header Text
                    </label>
                    <input
                      type="text"
                      value={activePage.summary || ""}
                      onChange={(e) => handleActivePageChange("summary", e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand-light"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">
                      Content Body (Plain Text &amp; Whitespace Preserved)
                    </label>
                    <textarea
                      rows={10}
                      value={activePage.content}
                      onChange={(e) => handleActivePageChange("content", e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-normal leading-relaxed focus:outline-none focus:ring-2 focus:ring-brand-light"
                    />
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      disabled={savingPage}
                      onClick={handleSaveActivePage}
                      className="px-6 py-2.5 rounded-xl text-white text-xs font-bold shadow transition active:scale-95 disabled:opacity-50 cursor-pointer flex items-center space-x-1.5"
                      style={{
                        background: "linear-gradient(to bottom, #5ADBE5, #0A82A8)",
                      }}
                    >
                      {savingPage ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Saving to store_pages...</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-3.5 h-3.5" />
                          <span>Save Policy Page</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400">Select a page above to edit.</p>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              SUB-TAB 3: POPULAR SEARCHES
             ══════════════════════════════════════════════════════════════════ */}
          {subTab === "searches" && (
            <div className="bg-white rounded-3xl border border-slate-100 p-5 sm:p-6 shadow-xs space-y-6">
              <div>
                <h3 className="font-extrabold text-sm text-slate-900">
                  Storefront Popular Search Keywords
                </h3>
                <p className="text-xs text-slate-400">
                  Displayed as quick-search filter chips in the customer search modal
                </p>
              </div>

              {/* Add New Keyword */}
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newSearchQuery}
                  onChange={(e) => setNewSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddSearch();
                    }
                  }}
                  placeholder="e.g. 65W GaN Charger or iPhone 16 Glass..."
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand-light"
                />
                <button
                  type="button"
                  onClick={handleAddSearch}
                  className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold transition cursor-pointer flex items-center space-x-1"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Keyword</span>
                </button>
              </div>

              {/* Keywords Tag List */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600 block">
                  Active Popular Searches ({popularSearches.length})
                </label>
                <div className="flex flex-wrap gap-2">
                  {popularSearches.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-800 text-xs font-bold border border-slate-200"
                    >
                      <span>{tag}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveSearch(tag)}
                        className="text-slate-400 hover:text-rose-500 transition cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-slate-100">
                <button
                  type="button"
                  disabled={savingSearches}
                  onClick={handleSaveSearches}
                  className="px-6 py-2.5 rounded-xl text-white text-xs font-bold shadow transition active:scale-95 disabled:opacity-50 cursor-pointer flex items-center space-x-1.5"
                  style={{
                    background: "linear-gradient(to bottom, #5ADBE5, #0A82A8)",
                  }}
                >
                  {savingSearches ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving Searches...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>Save Popular Searches</span>
                    </>
                  )}
                </button>
              </div>

              {/* ── Search Insights & Synonym Intelligence Card ── */}
              <div className="pt-6 border-t border-slate-100 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900 flex items-center space-x-1.5">
                      <Sparkles className="w-4 h-4 text-brand-dark" />
                      <span>Search Insights &amp; Zero-Result Analytics</span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      Top search queries that returned 0 exact matches. Map synonyms to eliminate dead-ends.
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      disabled={refreshingVocab}
                      onClick={handleRefreshVocab}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${refreshingVocab ? "animate-spin text-brand-dark" : "text-slate-500"}`} />
                      <span>{refreshingVocab ? "Harvesting..." : "Refresh Vocabulary"}</span>
                    </button>
                  </div>
                </div>

                {/* Timeframe Selector Pills */}
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-slate-500">Timeframe:</span>
                  {[7, 30, 90].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setSearchInsightsDays(d)}
                      className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                        searchInsightsDays === d
                          ? "bg-brand-dark text-white shadow-xs"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      Last {d} Days
                    </button>
                  ))}
                </div>

                {/* Zero Results List */}
                {loadingInsights ? (
                  <div className="py-8 text-center text-xs text-slate-400 flex items-center justify-center space-x-2">
                    <Loader2 className="w-4 h-4 animate-spin text-brand-dark" />
                    <span>Loading search analytics...</span>
                  </div>
                ) : zeroResultSearches.length > 0 ? (
                  <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl overflow-hidden">
                    {zeroResultSearches.map((rec) => (
                      <div key={rec.normalized_query} className="p-3.5 bg-slate-50/50 hover:bg-slate-50 transition space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center space-x-2 min-w-0">
                            <span className="font-black text-slate-900 text-xs truncate">
                              "{rec.normalized_query}"
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-50 text-rose-700 border border-rose-100">
                              {rec.search_count} {rec.search_count === 1 ? "miss" : "misses"}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              if (activeSynonymQuery === rec.normalized_query) {
                                setActiveSynonymQuery(null);
                                setSynonymInput("");
                              } else {
                                setActiveSynonymQuery(rec.normalized_query);
                                setSynonymInput("");
                              }
                            }}
                            className="px-2.5 py-1 rounded-lg text-xs font-bold text-brand-dark bg-brand-light/15 hover:bg-brand-light/25 transition cursor-pointer shrink-0"
                          >
                            {activeSynonymQuery === rec.normalized_query ? "Cancel" : "+ Add Synonym"}
                          </button>
                        </div>

                        {/* Inline Synonym Input Form */}
                        {activeSynonymQuery === rec.normalized_query && (
                          <div className="p-3 bg-white rounded-xl border border-brand-light/30 shadow-2xs space-y-2 animate-in fade-in duration-200">
                            <label className="text-[11px] font-bold text-slate-700 block">
                              Map "{rec.normalized_query}" to synonyms (comma-separated):
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={synonymInput}
                                onChange={(e) => setSynonymInput(e.target.value)}
                                placeholder="e.g. infinix, mobile chargers, tempered glass..."
                                className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand-light"
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    handleSaveSynonym(rec.normalized_query);
                                  }
                                }}
                              />
                              <button
                                type="button"
                                disabled={savingSynonym || !synonymInput.trim()}
                                onClick={() => handleSaveSynonym(rec.normalized_query)}
                                className="px-3.5 py-1.5 rounded-lg bg-slate-900 text-white font-bold text-xs disabled:opacity-50 cursor-pointer hover:bg-black transition"
                              >
                                {savingSynonym ? "Saving..." : "Save"}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 text-center rounded-2xl bg-slate-50/60 border border-slate-100 text-xs text-slate-500">
                    <Check className="w-5 h-5 text-emerald-500 mx-auto mb-1.5" />
                    <p className="font-bold text-slate-700">No zero-result searches in this period!</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Customers are successfully finding matching products in your catalog.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              SUB-TAB 4: IMAGE COMPRESSOR & OPTIMIZER TOOL
             ══════════════════════════════════════════════════════════════════ */}
          {subTab === "compressor" && <ImageCompressorTool />}

          {/* ══════════════════════════════════════════════════════════════════
              SUB-TAB 5: HOME BESTSELLERS CURATION
             ══════════════════════════════════════════════════════════════════ */}
          {subTab === "bestsellers" && (
            <div className="space-y-6">
              {/* Header Box */}
              <div className="bg-linear-to-br from-amber-500/10 via-amber-500/5 to-transparent p-6 rounded-3xl border border-amber-200/60 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start space-x-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm shadow-amber-500/20">
                      <Award className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                          Home Page Bestsellers Showcase
                        </h3>
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-100 text-amber-800 border border-amber-200">
                          {bestsellers.length} Curated
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Curate the high-margin products displayed in the &ldquo;Bestsellers&rdquo; slider on your storefront homepage. Products selected here instantly appear on the home page.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    <button
                      type="button"
                      onClick={loadBestsellers}
                      disabled={loadingBestsellers}
                      className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold transition flex items-center space-x-1 cursor-pointer"
                      title="Refresh bestsellers list"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${loadingBestsellers ? "animate-spin" : ""}`} />
                      <span className="hidden sm:inline">Refresh</span>
                    </button>
                    <a
                      href="/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition flex items-center space-x-1.5 shadow-sm shadow-amber-500/20"
                    >
                      <span>Preview Storefront</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>

                {/* Autocomplete Search to Add Products */}
                <div className="relative pt-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Search &amp; Add Products to Bestsellers
                  </label>
                  <div className="relative flex items-center">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
                    <input
                      type="text"
                      value={bestsellerSearchQuery}
                      onChange={(e) => setBestsellerSearchQuery(e.target.value)}
                      placeholder="Type product name, model, or SKU to search and add (e.g. Type-C, Earphones, Glass)..."
                      className="w-full pl-10 pr-24 py-2.5 rounded-2xl bg-white border border-amber-200 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 shadow-xs"
                    />
                    {bestsellerSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setBestsellerSearchQuery("")}
                        className="absolute right-3 p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Autocomplete Results Panel */}
                  {bestsellerSearchQuery.trim() && (
                    <div className="mt-2 bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden z-20 max-h-80 overflow-y-auto">
                      {isSearchingBestsellers ? (
                        <div className="p-4 text-center text-xs text-slate-400 flex items-center justify-center space-x-2">
                          <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                          <span>Searching catalog products...</span>
                        </div>
                      ) : bestsellerSearchResults.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-400">
                          No matching un-featured products found for &ldquo;{bestsellerSearchQuery}&rdquo;
                        </div>
                      ) : (
                        <div className="divide-y divide-slate-100">
                          <div className="px-3 py-1.5 bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                            Found {bestsellerSearchResults.length} Catalog Matches
                          </div>
                          {bestsellerSearchResults.map((prod) => {
                            const isAdding = togglingBestsellerId === prod.id;
                            const imgUrl = prod.images?.[0] || "/placeholder.png";
                            return (
                              <div
                                key={prod.id}
                                className="p-3 flex items-center justify-between hover:bg-amber-50/40 transition gap-3"
                              >
                                <div className="flex items-center space-x-3 min-w-0">
                                  <img
                                    src={imgUrl}
                                    alt={prod.name}
                                    className="w-10 h-10 rounded-xl object-cover bg-slate-100 border border-slate-200 shrink-0"
                                    onError={(e) => {
                                      (e.currentTarget as HTMLImageElement).src = "/placeholder.png";
                                    }}
                                  />
                                  <div className="min-w-0">
                                    <h4 className="text-xs font-bold text-slate-800 truncate">
                                      {prod.name}
                                    </h4>
                                    <div className="flex items-center space-x-2 text-[11px] text-slate-400 mt-0.5">
                                      <span className="font-mono text-slate-600 font-semibold">{prod.sku || "NO-SKU"}</span>
                                      <span>•</span>
                                      <span className="text-emerald-600 font-bold">₹{prod.price}</span>
                                      {prod.is_urbanrat_brand && (
                                        <>
                                          <span>•</span>
                                          <span className="text-brand-dark font-semibold">Urbanrat</span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handleAddBestseller(prod)}
                                  disabled={isAdding}
                                  className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition flex items-center space-x-1 shrink-0 cursor-pointer disabled:opacity-50 shadow-xs"
                                >
                                  {isAdding ? (
                                    <>
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      <span>Adding...</span>
                                    </>
                                  ) : (
                                    <>
                                      <Plus className="w-3.5 h-3.5" />
                                      <span>Add to Bestsellers</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Curated Bestsellers Grid */}
              <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 tracking-tight">
                      Active Home Bestsellers ({bestsellers.length})
                    </h3>
                    <p className="text-xs text-slate-400">
                      These products are rendered in order inside the Home Page Bestsellers slider
                    </p>
                  </div>
                </div>

                {loadingBestsellers ? (
                  <div className="p-12 text-center text-xs text-slate-400 flex items-center justify-center space-x-2">
                    <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
                    <span>Loading curated bestsellers...</span>
                  </div>
                ) : bestsellers.length === 0 ? (
                  <div className="p-12 text-center rounded-2xl bg-slate-50 border border-slate-100 space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
                      <Star className="w-6 h-6 fill-amber-400 text-amber-500" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">No Bestsellers Curated Yet</h4>
                      <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                        Use the search bar above or the star icon in the Products table to choose products for the Home Page Bestsellers section.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {bestsellers.map((prod, index) => {
                      const isRemoving = togglingBestsellerId === prod.id;
                      const imgUrl = prod.images?.[0] || "/placeholder.png";
                      return (
                        <div
                          key={prod.id}
                          className="bg-white rounded-2xl border border-slate-200/80 p-3.5 flex flex-col justify-between hover:shadow-md transition group"
                        >
                          <div>
                            {/* Top badge bar */}
                            <div className="flex items-center justify-between mb-2.5">
                              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase bg-amber-100 text-amber-800 border border-amber-200">
                                <Award className="w-3 h-3 text-amber-600" />
                                <span>#{index + 1} Bestseller</span>
                              </span>
                              {prod.is_urbanrat_brand && (
                                <span className="text-[10px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-100">
                                  Urbanrat
                                </span>
                              )}
                            </div>

                            {/* Image & Title */}
                            <div className="aspect-square rounded-xl bg-slate-100 overflow-hidden mb-2.5 border border-slate-100">
                              <img
                                src={imgUrl}
                                alt={prod.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).src = "/placeholder.png";
                                }}
                              />
                            </div>

                            <h4 className="text-xs font-bold text-slate-900 line-clamp-2 leading-snug mb-1">
                              {prod.name}
                            </h4>
                            <p className="text-[11px] font-mono text-slate-400 mb-2">
                              {prod.sku || "NO-SKU"}
                            </p>

                            <div className="flex items-baseline space-x-2 mb-3">
                              <span className="text-sm font-black text-slate-900">
                                ₹{prod.price}
                              </span>
                              {prod.mrp && prod.mrp > prod.price && (
                                <span className="text-[11px] text-slate-400 line-through">
                                  ₹{prod.mrp}
                                </span>
                              )}
                              {prod.price_tiers && prod.price_tiers.length > 0 && (
                                <span className="text-[10px] font-semibold text-brand-dark bg-brand-light/20 px-1.5 py-0.5 rounded">
                                  {prod.price_tiers.length} Tiers
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Action Button */}
                          <button
                            type="button"
                            onClick={() => handleRemoveBestseller(prod)}
                            disabled={isRemoving}
                            className="w-full py-2 px-3 rounded-xl border border-rose-200 bg-rose-50/50 hover:bg-rose-100 text-rose-600 text-xs font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
                          >
                            {isRemoving ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Removing...</span>
                              </>
                            ) : (
                              <>
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Remove from Bestsellers</span>
                              </>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
