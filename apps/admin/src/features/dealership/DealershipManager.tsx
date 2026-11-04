import React, { useState, useEffect, useCallback } from "react";
import type {
  DealershipTierMargin,
  DealershipTierMarginInput,
  DealershipItemShowcase,
  DealershipItemShowcaseInput,
  DealershipBenefitComparison,
  DealershipBenefitComparisonInput,
  DealershipArticle,
} from "@urbanrat/shared";
import {
  fetchAdminDealershipMargins,
  createDealershipMargin,
  updateDealershipMargin,
  deleteDealershipMargin,
  fetchAdminDealershipShowcase,
  createDealershipShowcase,
  updateDealershipShowcase,
  deleteDealershipShowcase,
  fetchAdminDealershipBenefits,
  createDealershipBenefit,
  updateDealershipBenefit,
  deleteDealershipBenefit,
  fetchAdminDealershipArticles,
  updateDealershipArticle,
  uploadDealershipImage,
} from "../../lib/adminService";
import {
  Layers,
  Percent,
  Plus,
  Trash2,
  Save,
  Check,
  AlertCircle,
  Loader2,
  Upload,
  Eye,
  EyeOff,
  RefreshCw,
  Award,
  CheckCircle2,
  FileText,
  Package,
} from "lucide-react";

export function DealershipManager() {
  const [activeTab, setActiveTab] = useState<
    "showcase" | "margins" | "benefits" | "articles"
  >("showcase");

  // State
  const [margins, setMargins] = useState<DealershipTierMargin[]>([]);
  const [showcases, setShowcases] = useState<DealershipItemShowcase[]>([]);
  const [benefits, setBenefits] = useState<DealershipBenefitComparison[]>([]);
  const [articles, setArticles] = useState<DealershipArticle[]>([]);

  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dbNotice, setDbNotice] = useState<string | null>(null);

  // Form states for new entries
  const [showNewShowcaseModal, setShowNewShowcaseModal] = useState(false);
  const [newShowcase, setNewShowcase] = useState<DealershipItemShowcaseInput>({
    item_type: "branded",
    title: "",
    subtitle: "",
    image_url: "",
    packaging_type: "",
    warranty_type: "",
    quality_grade: "",
    target_customer: "",
    dealer_margin: "",
    features: [""],
    sort_order: 1,
    is_active: true,
  });

  const [showNewMarginModal, setShowNewMarginModal] = useState(false);
  const [newMargin, setNewMargin] = useState<DealershipTierMarginInput>({
    item_type: "branded",
    category: "Fast Chargers",
    item_name: "",
    lot_size: "20 pcs / carton",
    cost_price: 250,
    retail_price_range: "₹599 – ₹799",
    margin_percentage: "+140%",
    profit_per_lot: "₹7,000",
    description: "",
    badge_text: "BRANDED ORIGINAL",
    sort_order: 1,
    is_active: true,
  });

  const [showNewBenefitModal, setShowNewBenefitModal] = useState(false);
  const [newBenefit, setNewBenefit] = useState<DealershipBenefitComparisonInput>({
    feature_name: "",
    normal_person_benefit: "",
    urt_dealer_benefit: "",
    category: "Commercial",
    sort_order: 1,
    is_active: true,
  });

  function showToast(msg: string) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  }

  const loadAllDealershipData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setDbNotice(null);
    try {
      const [marginsData, showcaseData, benefitsData, articlesData] =
        await Promise.all([
          fetchAdminDealershipMargins(),
          fetchAdminDealershipShowcase(),
          fetchAdminDealershipBenefits(),
          fetchAdminDealershipArticles(),
        ]);
      setMargins(marginsData);
      setShowcases(showcaseData);
      setBenefits(benefitsData);
      setArticles(articlesData);
    } catch (err: any) {
      console.warn("Failed to fetch dealership data:", err);
      if (
        err?.code === "PGRST205" ||
        err?.message?.includes("dealership_")
      ) {
        setDbNotice(
          "Table(s) for dealership program not created yet. Please execute migration 029_dealership_program.sql in Supabase SQL editor."
        );
      } else {
        setError(err?.message || "Failed to load dealership records.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllDealershipData();
  }, [loadAllDealershipData]);

  // Image upload handler
  async function handleImageUpload(
    file: File,
    target: "newShowcase" | string,
    folder: "branded" | "copy" = "branded"
  ) {
    setUploading(target);
    setError(null);
    try {
      const publicUrl = await uploadDealershipImage(file, folder);
      if (target === "newShowcase") {
        setNewShowcase((prev) => ({ ...prev, image_url: publicUrl }));
      } else {
        // Target is an existing showcase id
        setShowcases((prev) =>
          prev.map((s) => (s.id === target ? { ...s, image_url: publicUrl } : s))
        );
      }
      showToast("Image uploaded successfully!");
    } catch (err: any) {
      console.error("Upload error:", err);
      setError(err?.message || "Failed to upload image.");
    } finally {
      setUploading(null);
    }
  }

  // --------------------------------------------------------------------------
  // Showcase Handlers
  // --------------------------------------------------------------------------
  async function handleCreateShowcase(e: React.FormEvent) {
    e.preventDefault();
    if (!newShowcase.title.trim() || !newShowcase.image_url.trim()) {
      setError("Please provide a title and upload an image for the showcase.");
      return;
    }
    setSavingId("new-showcase");
    setError(null);
    try {
      const created = await createDealershipShowcase({
        ...newShowcase,
        features: newShowcase.features.filter((f) => f.trim().length > 0),
      });
      setShowcases((prev) => [...prev, created]);
      setShowNewShowcaseModal(false);
      setNewShowcase({
        item_type: "branded",
        title: "",
        subtitle: "",
        image_url: "",
        packaging_type: "",
        warranty_type: "",
        quality_grade: "",
        target_customer: "",
        dealer_margin: "",
        features: [""],
        sort_order: showcases.length + 1,
        is_active: true,
      });
      showToast("✨ Showcase item created successfully!");
    } catch (err: any) {
      setError(err?.message || "Failed to create showcase item.");
    } finally {
      setSavingId(null);
    }
  }

  async function handleSaveShowcase(item: DealershipItemShowcase) {
    setSavingId(item.id);
    setError(null);
    try {
      await updateDealershipShowcase(item);
      showToast(`Saved "${item.title}" successfully!`);
    } catch (err: any) {
      setError(err?.message || "Failed to update showcase item.");
    } finally {
      setSavingId(null);
    }
  }

  async function handleDeleteShowcase(id: string, title: string) {
    if (!window.confirm(`Delete showcase card "${title}"?`)) return;
    setDeletingId(id);
    try {
      await deleteDealershipShowcase(id);
      setShowcases((prev) => prev.filter((s) => s.id !== id));
      showToast("Showcase card deleted.");
    } catch (err: any) {
      setError(err?.message || "Failed to delete showcase item.");
    } finally {
      setDeletingId(null);
    }
  }

  // --------------------------------------------------------------------------
  // Margin Handlers
  // --------------------------------------------------------------------------
  async function handleCreateMargin(e: React.FormEvent) {
    e.preventDefault();
    if (!newMargin.item_name.trim()) {
      setError("Please specify an item name.");
      return;
    }
    setSavingId("new-margin");
    setError(null);
    try {
      const created = await createDealershipMargin({
        ...newMargin,
        badge_text:
          newMargin.item_type === "branded"
            ? "BRANDED ORIGINAL"
            : "FAST TURNOVER COPY",
      });
      setMargins((prev) => [...prev, created]);
      setShowNewMarginModal(false);
      setNewMargin({
        item_type: "branded",
        category: "Fast Chargers",
        item_name: "",
        lot_size: "20 pcs / carton",
        cost_price: 250,
        retail_price_range: "₹599 – ₹799",
        margin_percentage: "+140%",
        profit_per_lot: "₹7,000",
        description: "",
        badge_text: "BRANDED ORIGINAL",
        sort_order: margins.length + 1,
        is_active: true,
      });
      showToast("✨ Category margin row added!");
    } catch (err: any) {
      setError(err?.message || "Failed to add margin row.");
    } finally {
      setSavingId(null);
    }
  }

  async function handleSaveMargin(item: DealershipTierMargin) {
    setSavingId(item.id);
    setError(null);
    try {
      await updateDealershipMargin(item);
      showToast(`Saved margin row for "${item.item_name}"!`);
    } catch (err: any) {
      setError(err?.message || "Failed to save margin row.");
    } finally {
      setSavingId(null);
    }
  }

  async function handleDeleteMargin(id: string, name: string) {
    if (!window.confirm(`Delete margin row "${name}"?`)) return;
    setDeletingId(id);
    try {
      await deleteDealershipMargin(id);
      setMargins((prev) => prev.filter((m) => m.id !== id));
      showToast("Margin row deleted.");
    } catch (err: any) {
      setError(err?.message || "Failed to delete margin row.");
    } finally {
      setDeletingId(null);
    }
  }

  // --------------------------------------------------------------------------
  // Benefits Comparison Handlers
  // --------------------------------------------------------------------------
  async function handleCreateBenefit(e: React.FormEvent) {
    e.preventDefault();
    if (!newBenefit.feature_name.trim()) {
      setError("Feature name cannot be empty.");
      return;
    }
    setSavingId("new-benefit");
    setError(null);
    try {
      const created = await createDealershipBenefit(newBenefit);
      setBenefits((prev) => [...prev, created]);
      setShowNewBenefitModal(false);
      setNewBenefit({
        feature_name: "",
        normal_person_benefit: "",
        urt_dealer_benefit: "",
        category: "Commercial",
        sort_order: benefits.length + 1,
        is_active: true,
      });
      showToast("✨ Benefit differentiation row added!");
    } catch (err: any) {
      setError(err?.message || "Failed to add benefit row.");
    } finally {
      setSavingId(null);
    }
  }

  async function handleSaveBenefit(item: DealershipBenefitComparison) {
    setSavingId(item.id);
    setError(null);
    try {
      await updateDealershipBenefit(item);
      showToast(`Saved feature "${item.feature_name}"!`);
    } catch (err: any) {
      setError(err?.message || "Failed to update benefit row.");
    } finally {
      setSavingId(null);
    }
  }

  async function handleDeleteBenefit(id: string, name: string) {
    if (!window.confirm(`Delete benefit row "${name}"?`)) return;
    setDeletingId(id);
    try {
      await deleteDealershipBenefit(id);
      setBenefits((prev) => prev.filter((b) => b.id !== id));
      showToast("Benefit row deleted.");
    } catch (err: any) {
      setError(err?.message || "Failed to delete benefit row.");
    } finally {
      setDeletingId(null);
    }
  }

  // --------------------------------------------------------------------------
  // Articles Handlers
  // --------------------------------------------------------------------------
  async function handleSaveArticle(article: DealershipArticle) {
    setSavingId(article.id);
    setError(null);
    try {
      await updateDealershipArticle(article);
      showToast(`Saved article "${article.title}"!`);
    } catch (err: any) {
      setError(err?.message || "Failed to update article.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Top Header Controls ── */}
      <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center space-x-2">
              <span className="p-1.5 rounded-lg bg-brand/10 text-brand-dark">
                <Award className="w-4 h-4" />
              </span>
              <span>Dealership Program Management</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Configure Branded vs Copy showcase images, profit margins, differentiation comparison, and short articles.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={loadAllDealershipData}
              disabled={loading}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Feedback alerts */}
        {toastMessage && (
          <div className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <Check className="w-3.5 h-3.5 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {error && (
          <div className="flex items-center space-x-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-medium">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {dbNotice && (
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
            <div>
              <p className="font-bold">Database Migration Notice (029)</p>
              <p className="text-amber-700 mt-0.5">{dbNotice}</p>
            </div>
          </div>
        )}

        {/* Sub-tab navigation */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setActiveTab("showcase")}
            className={`inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === "showcase"
                ? "bg-brand-dark text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Branded vs Copy Showcase ({showcases.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("margins")}
            className={`inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === "margins"
                ? "bg-brand-dark text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <Percent className="w-3.5 h-3.5" />
            <span>Category Profit Margins ({margins.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("benefits")}
            className={`inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === "benefits"
                ? "bg-brand-dark text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Dealer vs Normal Differentiation ({benefits.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("articles")}
            className={`inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === "articles"
                ? "bg-brand-dark text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Dealership Short Articles ({articles.length})</span>
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          TAB 1: BRANDED VS COPY ITEM SHOWCASE & IMAGES
          ══════════════════════════════════════════════════════════════════ */}
      {activeTab === "showcase" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-black text-slate-900 tracking-tight">
                Branded vs Copy Visual Item Showcase
              </h4>
              <p className="text-xs text-slate-400">
                Upload real comparison photos to visually differentiate authentic Urbanrat gear from commercial copies.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowNewShowcaseModal(true)}
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-brand-dark hover:bg-brand transition shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Comparison Item</span>
            </button>
          </div>

          {/* Form Modal / Box */}
          {showNewShowcaseModal && (
            <form
              onSubmit={handleCreateShowcase}
              className="bg-white p-5 rounded-3xl border-2 border-brand/30 shadow-sm space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h5 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  Create Comparison Card
                </h5>
                <button
                  type="button"
                  onClick={() => setShowNewShowcaseModal(false)}
                  className="text-xs font-bold text-slate-400 hover:text-slate-600"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Classification Type
                  </label>
                  <select
                    value={newShowcase.item_type}
                    onChange={(e) =>
                      setNewShowcase((prev) => ({
                        ...prev,
                        item_type: e.target.value as "branded" | "copy",
                      }))
                    }
                    className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-white"
                  >
                    <option value="branded">Branded Item (Urbanrat Original)</option>
                    <option value="copy">Normal / Copy Compatible Item</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Title
                  </label>
                  <input
                    type="text"
                    required
                    value={newShowcase.title}
                    onChange={(e) =>
                      setNewShowcase((prev) => ({ ...prev, title: e.target.value }))
                    }
                    placeholder="e.g. Urbanrat 65W GaN Pro (Branded)"
                    className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-200"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Subtitle
                  </label>
                  <input
                    type="text"
                    value={newShowcase.subtitle || ""}
                    onChange={(e) =>
                      setNewShowcase((prev) => ({ ...prev, subtitle: e.target.value }))
                    }
                    placeholder="Short highlight description"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200"
                  />
                </div>

                {/* Image Upload */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Item Photo Image URL / Upload
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      required
                      value={newShowcase.image_url}
                      onChange={(e) =>
                        setNewShowcase((prev) => ({ ...prev, image_url: e.target.value }))
                      }
                      placeholder="Paste image URL or choose file below..."
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200"
                    />
                    <label className="inline-flex items-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer shrink-0">
                      <Upload className="w-3.5 h-3.5" />
                      <span>{uploading === "newShowcase" ? "Uploading..." : "Upload"}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleImageUpload(file, "newShowcase", newShowcase.item_type);
                        }}
                      />
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Packaging Type
                  </label>
                  <input
                    type="text"
                    value={newShowcase.packaging_type || ""}
                    onChange={(e) =>
                      setNewShowcase((prev) => ({ ...prev, packaging_type: e.target.value }))
                    }
                    placeholder="e.g. Metallic retail box with QR seal"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Warranty / Replacement
                  </label>
                  <input
                    type="text"
                    value={newShowcase.warranty_type || ""}
                    onChange={(e) =>
                      setNewShowcase((prev) => ({ ...prev, warranty_type: e.target.value }))
                    }
                    placeholder="e.g. 1-Year Instant DOA Swap"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Quality Grade
                  </label>
                  <input
                    type="text"
                    value={newShowcase.quality_grade || ""}
                    onChange={(e) =>
                      setNewShowcase((prev) => ({ ...prev, quality_grade: e.target.value }))
                    }
                    placeholder="e.g. Tier-1 GaN III Architecture"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Dealer Margin Markup
                  </label>
                  <input
                    type="text"
                    value={newShowcase.dealer_margin || ""}
                    onChange={(e) =>
                      setNewShowcase((prev) => ({ ...prev, dealer_margin: e.target.value }))
                    }
                    placeholder="e.g. 145% – 180% Gross Profit"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={savingId === "new-showcase"}
                  className="inline-flex items-center space-x-1.5 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-brand-dark hover:bg-brand transition shadow-sm cursor-pointer"
                >
                  {savingId === "new-showcase" ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                  <span>Save Showcase Card to Supabase</span>
                </button>
              </div>
            </form>
          )}

          {/* List of existing showcase items */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {showcases.map((item) => {
              const isSaving = savingId === item.id;
              const isDeleting = deletingId === item.id;

              return (
                <div
                  key={item.id}
                  className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          item.item_type === "branded"
                            ? "bg-cyan-100 text-brand-dark border border-cyan-200"
                            : "bg-amber-100 text-amber-900 border border-amber-200"
                        }`}
                      >
                        {item.item_type === "branded"
                          ? "BRANDED ORIGINAL"
                          : "NORMAL / COPY COMPATIBLE"}
                      </span>

                      <div className="flex items-center space-x-1">
                        <button
                          type="button"
                          onClick={() => {
                            const updated = { ...item, is_active: !item.is_active };
                            handleSaveShowcase(updated);
                          }}
                          className={`p-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                            item.is_active
                              ? "text-emerald-700 bg-emerald-50"
                              : "text-slate-400 bg-slate-100"
                          }`}
                        >
                          {item.is_active ? (
                            <Eye className="w-3.5 h-3.5" />
                          ) : (
                            <EyeOff className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteShowcase(item.id, item.title)}
                          disabled={isDeleting}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Image Preview & Upload */}
                    <div className="flex items-center space-x-3">
                      <div className="w-20 h-20 rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt={item.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Package className="w-8 h-8 text-slate-300" />
                        )}
                      </div>
                      <div className="flex-1 space-y-1">
                        <input
                          type="text"
                          value={item.title}
                          onChange={(e) =>
                            setShowcases((prev) =>
                              prev.map((s) =>
                                s.id === item.id ? { ...s, title: e.target.value } : s
                              )
                            )
                          }
                          className="w-full font-black text-xs text-slate-900 border-b border-transparent focus:border-brand px-1"
                        />
                        <input
                          type="text"
                          value={item.subtitle || ""}
                          onChange={(e) =>
                            setShowcases((prev) =>
                              prev.map((s) =>
                                s.id === item.id ? { ...s, subtitle: e.target.value } : s
                              )
                            )
                          }
                          placeholder="Subtitle..."
                          className="w-full text-[11px] text-slate-500 border-b border-transparent focus:border-brand px-1"
                        />
                        <div className="pt-1">
                          <label className="text-[10px] font-bold text-brand-dark hover:underline cursor-pointer flex items-center space-x-1">
                            <Upload className="w-3 h-3" />
                            <span>
                              {uploading === item.id ? "Uploading image..." : "Change Image"}
                            </span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleImageUpload(file, item.id, item.item_type);
                              }}
                            />
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* Quick attributes */}
                    <div className="grid grid-cols-2 gap-2 text-[11px] pt-2 border-t border-slate-100">
                      <div>
                        <span className="text-slate-400 block text-[9px] uppercase font-bold">
                          Packaging
                        </span>
                        <input
                          type="text"
                          value={item.packaging_type || ""}
                          onChange={(e) =>
                            setShowcases((prev) =>
                              prev.map((s) =>
                                s.id === item.id
                                  ? { ...s, packaging_type: e.target.value }
                                  : s
                              )
                            )
                          }
                          className="w-full font-semibold text-slate-700 text-xs border border-slate-100 rounded px-1.5 py-0.5"
                        />
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[9px] uppercase font-bold">
                          Warranty
                        </span>
                        <input
                          type="text"
                          value={item.warranty_type || ""}
                          onChange={(e) =>
                            setShowcases((prev) =>
                              prev.map((s) =>
                                s.id === item.id ? { ...s, warranty_type: e.target.value } : s
                              )
                            )
                          }
                          className="w-full font-semibold text-slate-700 text-xs border border-slate-100 rounded px-1.5 py-0.5"
                        />
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[9px] uppercase font-bold">
                          Quality Grade
                        </span>
                        <input
                          type="text"
                          value={item.quality_grade || ""}
                          onChange={(e) =>
                            setShowcases((prev) =>
                              prev.map((s) =>
                                s.id === item.id ? { ...s, quality_grade: e.target.value } : s
                              )
                            )
                          }
                          className="w-full font-semibold text-slate-700 text-xs border border-slate-100 rounded px-1.5 py-0.5"
                        />
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[9px] uppercase font-bold">
                          Dealer Margin
                        </span>
                        <input
                          type="text"
                          value={item.dealer_margin || ""}
                          onChange={(e) =>
                            setShowcases((prev) =>
                              prev.map((s) =>
                                s.id === item.id ? { ...s, dealer_margin: e.target.value } : s
                              )
                            )
                          }
                          className="w-full font-semibold text-brand-dark text-xs border border-slate-100 rounded px-1.5 py-0.5"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => handleSaveShowcase(item)}
                      disabled={isSaving}
                      className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-brand-dark hover:bg-brand transition cursor-pointer"
                    >
                      {isSaving ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Save className="w-3.5 h-3.5" />
                      )}
                      <span>Save Changes</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB 2: CATEGORY PROFIT MARGINS TABLE
          ══════════════════════════════════════════════════════════════════ */}
      {activeTab === "margins" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-black text-slate-900 tracking-tight">
                Category Profit Margins Table
              </h4>
              <p className="text-xs text-slate-400">
                Update buy prices, retail price ranges, profit percentages, and lot sizes shown to dealers.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowNewMarginModal(true)}
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-brand-dark hover:bg-brand transition shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Margin Row</span>
            </button>
          </div>

          {/* New Margin Modal */}
          {showNewMarginModal && (
            <form
              onSubmit={handleCreateMargin}
              className="bg-white p-5 rounded-3xl border-2 border-brand/30 shadow-sm space-y-4"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h5 className="text-xs font-black uppercase text-slate-900">
                  Add Category Margin Row
                </h5>
                <button
                  type="button"
                  onClick={() => setShowNewMarginModal(false)}
                  className="text-xs font-bold text-slate-400 hover:text-slate-600"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Classification
                  </label>
                  <select
                    value={newMargin.item_type}
                    onChange={(e) =>
                      setNewMargin((prev) => ({
                        ...prev,
                        item_type: e.target.value as "branded" | "copy",
                      }))
                    }
                    className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-white"
                  >
                    <option value="branded">Branded Original</option>
                    <option value="copy">Normal / Copy Compatible</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Category Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newMargin.category}
                    onChange={(e) =>
                      setNewMargin((prev) => ({ ...prev, category: e.target.value }))
                    }
                    placeholder="e.g. Tempered Glass, Fast Chargers"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Item Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newMargin.item_name}
                    onChange={(e) =>
                      setNewMargin((prev) => ({ ...prev, item_name: e.target.value }))
                    }
                    placeholder="e.g. 9H Sapphire Tempered Glass"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Lot / Carton Sizing
                  </label>
                  <input
                    type="text"
                    value={newMargin.lot_size}
                    onChange={(e) =>
                      setNewMargin((prev) => ({ ...prev, lot_size: e.target.value }))
                    }
                    placeholder="e.g. 50 pcs / box"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Dealer Buy Cost (₹ / pc)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={newMargin.cost_price}
                    onChange={(e) =>
                      setNewMargin((prev) => ({
                        ...prev,
                        cost_price: parseFloat(e.target.value) || 0,
                      }))
                    }
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Retail Selling Price Range
                  </label>
                  <input
                    type="text"
                    value={newMargin.retail_price_range}
                    onChange={(e) =>
                      setNewMargin((prev) => ({
                        ...prev,
                        retail_price_range: e.target.value,
                      }))
                    }
                    placeholder="e.g. ₹99 – ₹149"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Gross Margin %
                  </label>
                  <input
                    type="text"
                    value={newMargin.margin_percentage}
                    onChange={(e) =>
                      setNewMargin((prev) => ({
                        ...prev,
                        margin_percentage: e.target.value,
                      }))
                    }
                    placeholder="e.g. +450% to +720%"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-bold text-emerald-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Profit Per Lot
                  </label>
                  <input
                    type="text"
                    value={newMargin.profit_per_lot}
                    onChange={(e) =>
                      setNewMargin((prev) => ({
                        ...prev,
                        profit_per_lot: e.target.value,
                      }))
                    }
                    placeholder="e.g. ₹4,050 – ₹6,550"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-black text-brand-dark"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Description Highlight
                  </label>
                  <input
                    type="text"
                    value={newMargin.description || ""}
                    onChange={(e) =>
                      setNewMargin((prev) => ({ ...prev, description: e.target.value }))
                    }
                    placeholder="e.g. High-volume counter footfall driver"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={savingId === "new-margin"}
                  className="inline-flex items-center space-x-1.5 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-brand-dark hover:bg-brand transition shadow-sm cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Margin Record to Supabase</span>
                </button>
              </div>
            </form>
          )}

          {/* Table display */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Category &amp; Item</th>
                  <th className="py-3 px-3">Lot Size</th>
                  <th className="py-3 px-3">Buy Price</th>
                  <th className="py-3 px-3">Sell Range</th>
                  <th className="py-3 px-3">Margin %</th>
                  <th className="py-3 px-3">Profit / Lot</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {margins.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/60">
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                          m.item_type === "branded"
                            ? "bg-cyan-50 text-brand-dark border border-cyan-200"
                            : "bg-amber-50 text-amber-900 border border-amber-200"
                        }`}
                      >
                        {m.item_type === "branded" ? "BRANDED" : "COPY"}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <input
                        type="text"
                        value={m.item_name}
                        onChange={(e) =>
                          setMargins((prev) =>
                            prev.map((item) =>
                              item.id === m.id ? { ...item, item_name: e.target.value } : item
                            )
                          )
                        }
                        className="font-bold text-slate-900 text-xs w-full border-b border-transparent focus:border-brand"
                      />
                      <span className="text-[10px] text-slate-400 block">{m.category}</span>
                    </td>
                    <td className="py-3 px-3">
                      <input
                        type="text"
                        value={m.lot_size}
                        onChange={(e) =>
                          setMargins((prev) =>
                            prev.map((item) =>
                              item.id === m.id ? { ...item, lot_size: e.target.value } : item
                            )
                          )
                        }
                        className="text-xs text-slate-600 w-24 border-b border-transparent focus:border-brand"
                      />
                    </td>
                    <td className="py-3 px-3">
                      <input
                        type="number"
                        value={m.cost_price}
                        onChange={(e) =>
                          setMargins((prev) =>
                            prev.map((item) =>
                              item.id === m.id
                                ? { ...item, cost_price: parseFloat(e.target.value) || 0 }
                                : item
                            )
                          )
                        }
                        className="text-xs font-bold text-slate-900 w-16 border-b border-transparent focus:border-brand"
                      />
                    </td>
                    <td className="py-3 px-3">
                      <input
                        type="text"
                        value={m.retail_price_range}
                        onChange={(e) =>
                          setMargins((prev) =>
                            prev.map((item) =>
                              item.id === m.id
                                ? { ...item, retail_price_range: e.target.value }
                                : item
                            )
                          )
                        }
                        className="text-xs text-slate-700 w-28 border-b border-transparent focus:border-brand"
                      />
                    </td>
                    <td className="py-3 px-3">
                      <input
                        type="text"
                        value={m.margin_percentage}
                        onChange={(e) =>
                          setMargins((prev) =>
                            prev.map((item) =>
                              item.id === m.id
                                ? { ...item, margin_percentage: e.target.value }
                                : item
                            )
                          )
                        }
                        className="text-xs font-bold text-emerald-700 w-28 border-b border-transparent focus:border-brand"
                      />
                    </td>
                    <td className="py-3 px-3">
                      <input
                        type="text"
                        value={m.profit_per_lot}
                        onChange={(e) =>
                          setMargins((prev) =>
                            prev.map((item) =>
                              item.id === m.id
                                ? { ...item, profit_per_lot: e.target.value }
                                : item
                            )
                          )
                        }
                        className="text-xs font-black text-brand-dark w-28 border-b border-transparent focus:border-brand"
                      />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center space-x-1.5">
                        <button
                          type="button"
                          onClick={() => handleSaveMargin(m)}
                          disabled={savingId === m.id}
                          className="p-1.5 rounded-lg bg-brand/10 text-brand-dark hover:bg-brand hover:text-white transition cursor-pointer"
                          title="Save Row"
                        >
                          <Save className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteMargin(m.id, m.item_name)}
                          disabled={deletingId === m.id}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                          title="Delete Row"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB 3: DEALER VS NORMAL PERSON DIFFERENTIATION TABLE
          ══════════════════════════════════════════════════════════════════ */}
      {activeTab === "benefits" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-black text-slate-900 tracking-tight">
                Differentiation Table: URT Dealer vs Normal Person
              </h4>
              <p className="text-xs text-slate-400">
                Configure the comparison grid shown at the bottom of the dealership page contrasting customer perks.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowNewBenefitModal(true)}
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-brand-dark hover:bg-brand transition shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Benefit Row</span>
            </button>
          </div>

          {/* New Benefit Form */}
          {showNewBenefitModal && (
            <form
              onSubmit={handleCreateBenefit}
              className="bg-white p-5 rounded-3xl border-2 border-brand/30 shadow-sm space-y-4"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h5 className="text-xs font-black uppercase text-slate-900">
                  New Benefit Row
                </h5>
                <button
                  type="button"
                  onClick={() => setShowNewBenefitModal(false)}
                  className="text-xs font-bold text-slate-400 hover:text-slate-600"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Feature / Benefit Category
                  </label>
                  <input
                    type="text"
                    required
                    value={newBenefit.feature_name}
                    onChange={(e) =>
                      setNewBenefit((prev) => ({ ...prev, feature_name: e.target.value }))
                    }
                    placeholder="e.g. Pricing Tier, Margin Potential"
                    className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-200"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Normal Person / Customer
                  </label>
                  <input
                    type="text"
                    required
                    value={newBenefit.normal_person_benefit}
                    onChange={(e) =>
                      setNewBenefit((prev) => ({
                        ...prev,
                        normal_person_benefit: e.target.value,
                      }))
                    }
                    placeholder="e.g. Standard Retail MRP (0% margin)"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    URT Authorized Dealer
                  </label>
                  <input
                    type="text"
                    required
                    value={newBenefit.urt_dealer_benefit}
                    onChange={(e) =>
                      setNewBenefit((prev) => ({
                        ...prev,
                        urt_dealer_benefit: e.target.value,
                      }))
                    }
                    placeholder="e.g. Unfiltered Tier-1 factory depot price"
                    className="w-full px-3 py-2 text-xs font-bold text-brand-dark rounded-xl border border-slate-200"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={savingId === "new-benefit"}
                  className="inline-flex items-center space-x-1.5 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-brand-dark hover:bg-brand transition shadow-sm cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Save Differentiation Row</span>
                </button>
              </div>
            </form>
          )}

          {/* List / Edit rows */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-xs divide-y divide-slate-100">
            {benefits.map((b) => (
              <div
                key={b.id}
                className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50/50"
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
                  <div>
                    <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                      Feature Name
                    </span>
                    <input
                      type="text"
                      value={b.feature_name}
                      onChange={(e) =>
                        setBenefits((prev) =>
                          prev.map((item) =>
                            item.id === b.id ? { ...item, feature_name: e.target.value } : item
                          )
                        )
                      }
                      className="w-full font-black text-xs text-slate-900 border border-slate-200 rounded-lg px-2.5 py-1.5"
                    />
                  </div>

                  <div>
                    <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                      Normal Person (Standard)
                    </span>
                    <input
                      type="text"
                      value={b.normal_person_benefit}
                      onChange={(e) =>
                        setBenefits((prev) =>
                          prev.map((item) =>
                            item.id === b.id
                              ? { ...item, normal_person_benefit: e.target.value }
                              : item
                          )
                        )
                      }
                      className="w-full text-xs text-slate-600 border border-slate-200 rounded-lg px-2.5 py-1.5"
                    />
                  </div>

                  <div>
                    <span className="block text-[10px] font-bold uppercase text-brand-dark mb-1">
                      URT Authorized Dealer
                    </span>
                    <input
                      type="text"
                      value={b.urt_dealer_benefit}
                      onChange={(e) =>
                        setBenefits((prev) =>
                          prev.map((item) =>
                            item.id === b.id
                              ? { ...item, urt_dealer_benefit: e.target.value }
                              : item
                          )
                        )
                      }
                      className="w-full font-bold text-xs text-brand-dark border border-cyan-200 bg-cyan-50/40 rounded-lg px-2.5 py-1.5"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0 self-end lg:self-center">
                  <button
                    type="button"
                    onClick={() => handleSaveBenefit(b)}
                    disabled={savingId === b.id}
                    className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-brand-dark hover:bg-brand transition cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteBenefit(b.id, b.feature_name)}
                    disabled={deletingId === b.id}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB 4: DEALERSHIP SHORT ARTICLES (BRANDED VS COPY)
          ══════════════════════════════════════════════════════════════════ */}
      {activeTab === "articles" && (
        <div className="space-y-6">
          <div>
            <h4 className="text-sm font-black text-slate-900 tracking-tight">
              Dealership Explainer Short Articles
            </h4>
            <p className="text-xs text-slate-400">
              Edit the two introductory articles on the frontend: Article 1 for Branded Dealership and Article 2 for Normal / Copy Dealership.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {articles.map((art) => (
              <div
                key={art.id}
                className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4"
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                      art.article_type === "branded"
                        ? "bg-cyan-100 text-brand-dark"
                        : "bg-amber-100 text-amber-900"
                    }`}
                  >
                    {art.article_type === "branded"
                      ? "Article 1: Branded Item Dealership"
                      : "Article 2: Normal / Copy Item Dealership"}
                  </span>
                  <span className="text-[11px] font-bold text-slate-400">
                    Badge: {art.badge}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Article Title
                  </label>
                  <input
                    type="text"
                    value={art.title}
                    onChange={(e) =>
                      setArticles((prev) =>
                        prev.map((item) =>
                          item.id === art.id ? { ...item, title: e.target.value } : item
                        )
                      )
                    }
                    className="w-full px-3 py-2 text-xs font-black rounded-xl border border-slate-200"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Short Summary (Displayed directly below visual tree diagram)
                  </label>
                  <textarea
                    rows={2}
                    value={art.short_summary}
                    onChange={(e) =>
                      setArticles((prev) =>
                        prev.map((item) =>
                          item.id === art.id
                            ? { ...item, short_summary: e.target.value }
                            : item
                        )
                      )
                    }
                    className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-200"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Full Article Content
                  </label>
                  <textarea
                    rows={5}
                    value={art.content}
                    onChange={(e) =>
                      setArticles((prev) =>
                        prev.map((item) =>
                          item.id === art.id ? { ...item, content: e.target.value } : item
                        )
                      )
                    }
                    className="w-full px-3 py-2 text-xs leading-relaxed rounded-xl border border-slate-200"
                  />
                </div>

                <div className="flex justify-end pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => handleSaveArticle(art)}
                    disabled={savingId === art.id}
                    className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-brand-dark hover:bg-brand transition cursor-pointer"
                  >
                    {savingId === art.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    <span>Save Article to Supabase</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
