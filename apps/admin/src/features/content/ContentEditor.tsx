import { useState, useEffect, useCallback } from "react";
import {
  fetchBanners,
  saveBanner,
  fetchStorePages,
  saveStorePage,
  fetchStoreSettings,
  updateStoreSetting,
  uploadBannerImage,
} from "../../lib/adminService";
import type { Banner, StorePage } from "@urbanrat/shared";
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
} from "lucide-react";

export function ContentEditor() {
  const [subTab, setSubTab] = useState<"banners" | "pages" | "searches">("banners");

  // 1. Banners state
  const [banners, setBanners] = useState<Banner[]>([]);
  const [bannerPlacement, setBannerPlacement] = useState<"all" | "home_hero" | "home_brand" | "urbanrat_hero">("all");
  const [savingBannerId, setSavingBannerId] = useState<string | null>(null);
  const [uploadingBannerId, setUploadingBannerId] = useState<string | null>(null);

  // 2. Pages state
  const [pages, setPages] = useState<StorePage[]>([]);
  const [selectedPageSlug, setSelectedPageSlug] = useState<string>("about");
  const [savingPage, setSavingPage] = useState(false);

  // 3. Popular Searches state
  const [popularSearches, setPopularSearches] = useState<string[]>([]);
  const [newSearchQuery, setNewSearchQuery] = useState("");
  const [savingSearches, setSavingSearches] = useState(false);

  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function showToast(msg: string) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  }

  const loadAllContent = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [bannersData, pagesData, settingsData] = await Promise.all([
        fetchBanners(),
        fetchStorePages(),
        fetchStoreSettings(),
      ]);

      setBanners(bannersData);
      setPages(pagesData);
      setPopularSearches(settingsData.popular_searches || []);
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
      const publicUrl = await uploadBannerImage(file);
      handleBannerChange(bannerId, "image_url", publicUrl);
      showToast("Banner image uploaded successfully!");
    } catch (err: any) {
      console.error("Banner image upload error:", err);
      setError(err?.message || "Failed to upload banner image to Supabase storage.");
    } finally {
      setUploadingBannerId(null);
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
      showToast(`Banner "${b.placement}" updated!`);
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
                ? "bg-[#0A82A8] text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Promotional Banners ({banners.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab("pages")}
            className={`inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              subTab === "pages"
                ? "bg-[#0A82A8] text-white shadow-xs"
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
                ? "bg-[#0A82A8] text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Popular Searches ({popularSearches.length})</span>
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
          <Loader2 className="w-5 h-5 animate-spin text-[#0A82A8]" />
          <span>Loading content configuration from Supabase...</span>
        </div>
      ) : (
        <>
          {/* ══════════════════════════════════════════════════════════════════
              SUB-TAB 1: BANNERS BY PLACEMENT
             ══════════════════════════════════════════════════════════════════ */}
          {subTab === "banners" && (
            <div className="space-y-4">
              {/* Placement Filter */}
              <div className="flex items-center space-x-2 bg-white p-3 rounded-2xl border border-slate-100 text-xs font-semibold">
                <span className="text-slate-400">Filter Placement:</span>
                {(["all", "home_hero", "home_brand", "urbanrat_hero"] as const).map(
                  (pl) => (
                    <button
                      key={pl}
                      type="button"
                      onClick={() => setBannerPlacement(pl)}
                      className={`px-3 py-1 rounded-xl transition cursor-pointer ${
                        bannerPlacement === pl
                          ? "bg-[#0A82A8] text-white font-bold"
                          : "text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      {pl === "all"
                        ? "All Placements"
                        : pl === "home_hero"
                        ? "Home Hero"
                        : pl === "home_brand"
                        ? "Brand Spotlight"
                        : "Urbanrat Brand Hero"}
                    </button>
                  )
                )}
              </div>

              {/* Banners List */}
              <div className="space-y-5">
                {filteredBanners.map((b) => (
                  <div
                    key={b.id}
                    className="bg-white rounded-3xl border border-slate-100 p-5 sm:p-6 shadow-xs space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                      <div>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-cyan-50 text-[#0A82A8] border border-cyan-200">
                          {b.placement}
                        </span>
                        <h3 className="text-sm font-black text-slate-900 mt-1">
                          {b.title}
                        </h3>
                      </div>

                      <div className="flex items-center space-x-3">
                        <label className="flex items-center space-x-1.5 text-xs font-bold text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={b.is_active}
                            onChange={(e) =>
                              handleBannerChange(b.id, "is_active", e.target.checked)
                            }
                            className="rounded text-[#0A82A8] focus:ring-[#5ADBE5]"
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
                          <span>Save Banner</span>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div className="space-y-1 sm:col-span-2">
                        <label className="font-bold text-slate-700">Banner Title</label>
                        <input
                          type="text"
                          value={b.title}
                          onChange={(e) =>
                            handleBannerChange(b.id, "title", e.target.value)
                          }
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#5ADBE5]"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="font-bold text-slate-700">Pill Badge Text</label>
                        <input
                          type="text"
                          value={b.badge_text || ""}
                          onChange={(e) =>
                            handleBannerChange(b.id, "badge_text", e.target.value)
                          }
                          placeholder="e.g. Urbanrat In-House Labs"
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#5ADBE5]"
                        />
                      </div>

                      <div className="space-y-2 sm:col-span-2 p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/80">
                        <div className="flex items-center justify-between">
                          <label className="font-bold text-slate-800 flex items-center space-x-1.5">
                            <ImageIcon className="w-4 h-4 text-[#0A82A8]" />
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
                            <div className={`relative rounded-xl overflow-hidden border border-slate-200 bg-white shadow-2xs group shrink-0 w-full sm:w-60 ${b.placement === "home_hero" ? "aspect-[5/4]" : "aspect-video"}`}>
                              <img
                                src={b.image_url}
                                alt={b.title || "Banner preview"}
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                <a
                                  href={b.image_url}
                                  target="_blank"
                                  rel="noreferrer"
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
                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0A82A8]" />
                                  ) : (
                                    <Upload className="w-3.5 h-3.5 text-[#0A82A8]" />
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
                                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#5ADBE5] bg-white"
                                />
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="p-4 rounded-xl border-2 border-dashed border-slate-200 bg-white flex flex-col sm:flex-row items-center justify-between gap-3">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 rounded-xl bg-[#5ADBE5]/10 flex items-center justify-center text-[#0A82A8]">
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

                      <div className="space-y-1 sm:col-span-2">
                        <label className="font-bold text-slate-700">Subtitle Description</label>
                        <textarea
                          rows={2}
                          value={b.subtitle || ""}
                          onChange={(e) =>
                            handleBannerChange(b.id, "subtitle", e.target.value)
                          }
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#5ADBE5]"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="font-bold text-slate-700">Primary CTA Text</label>
                        <input
                          type="text"
                          value={b.cta_text || ""}
                          onChange={(e) =>
                            handleBannerChange(b.id, "cta_text", e.target.value)
                          }
                          placeholder="Shop Wholesale"
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#5ADBE5]"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="font-bold text-slate-700">Primary CTA Link</label>
                        <input
                          type="text"
                          value={b.cta_link || ""}
                          onChange={(e) =>
                            handleBannerChange(b.id, "cta_link", e.target.value)
                          }
                          placeholder="/marketplace"
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#5ADBE5]"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

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
                        ? "bg-[#0A82A8] text-white shadow-xs"
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
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#5ADBE5]"
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
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#5ADBE5]"
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
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-normal leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#5ADBE5]"
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
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#5ADBE5]"
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
            </div>
          )}
        </>
      )}
    </div>
  );
}
