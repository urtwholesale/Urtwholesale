import { useState, useEffect } from "react";
import {
  type HomepageSection,
  type HomepageSectionType,
  type HomepageSectionTheme,
  DEFAULT_HOMEPAGE_SECTIONS,
  type Category,
} from "@urbanrat/shared";
import {
  fetchStoreSettings,
  updateStoreSetting,
  fetchCategories,
} from "../../lib/adminService";
import {
  Award,
  Crown,
  Headphones,
  Trophy,
  Zap,
  Flame,
  Volume2,
  Percent,
  Sparkles,
  ShieldCheck,
  Clock,
  ArrowUp,
  ArrowDown,
  Edit2,
  Trash2,
  Plus,
  Save,
  RotateCcw,
  Check,
  Eye,
  EyeOff,
  Sliders,
  X,
} from "lucide-react";

const AVAILABLE_ICONS = [
  { name: "Crown", label: "Crown (#1 Bestsellers)", icon: Crown },
  { name: "Zap", label: "Zap (100W PD Fast Charging)", icon: Zap },
  { name: "Headphones", label: "Headphones (Studio Audio)", icon: Headphones },
  { name: "Flame", label: "Flame (Hot New Drops)", icon: Flame },
  { name: "Trophy", label: "Trophy (Wholesale Top Margin)", icon: Trophy },
  { name: "Award", label: "Award (Certified Grade)", icon: Award },
  { name: "Volume2", label: "Volume2 (Speakers / Sound)", icon: Volume2 },
  { name: "Sparkles", label: "Sparkles (Premium Accessories)", icon: Sparkles },
  { name: "Percent", label: "Percent (Clearance Deals)", icon: Percent },
  { name: "ShieldCheck", label: "Shield (9H Sapphire Armor)", icon: ShieldCheck },
  { name: "Clock", label: "Clock (Express / Limited)", icon: Clock },
];

const THEME_OPTIONS: Array<{
  id: HomepageSectionTheme;
  label: string;
  badgeClass: string;
  dotClass: string;
}> = [
  { id: "amber", label: "Amber / Gold", badgeClass: "bg-amber-100 text-amber-800 border-amber-300", dotClass: "bg-amber-500" },
  { id: "cyan", label: "Cyan / Aqua", badgeClass: "bg-cyan-100 text-cyan-800 border-cyan-300", dotClass: "bg-cyan-500" },
  { id: "rose", label: "Rose / Red", badgeClass: "bg-rose-100 text-rose-800 border-rose-300", dotClass: "bg-rose-500" },
  { id: "violet", label: "Violet / Purple", badgeClass: "bg-violet-100 text-violet-800 border-violet-300", dotClass: "bg-violet-500" },
  { id: "emerald", label: "Emerald / Green", badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300", dotClass: "bg-emerald-500" },
  { id: "slate", label: "Slate / Obsidian", badgeClass: "bg-slate-100 text-slate-800 border-slate-300", dotClass: "bg-slate-500" },
  { id: "blue", label: "Blue / Cobalt", badgeClass: "bg-blue-100 text-blue-800 border-blue-300", dotClass: "bg-blue-500" },
  { id: "orange", label: "Orange / Flame", badgeClass: "bg-orange-100 text-orange-800 border-orange-300", dotClass: "bg-orange-500" },
];

function renderSectionIcon(iconName: string, className = "w-4 h-4") {
  switch (iconName) {
    case "Crown":
      return <Crown className={className} />;
    case "Headphones":
      return <Headphones className={className} />;
    case "Trophy":
      return <Trophy className={className} />;
    case "Award":
      return <Award className={className} />;
    case "Zap":
      return <Zap className={className} />;
    case "Flame":
      return <Flame className={className} />;
    case "Volume2":
      return <Volume2 className={className} />;
    case "Percent":
      return <Percent className={className} />;
    case "Sparkles":
      return <Sparkles className={className} />;
    case "ShieldCheck":
      return <ShieldCheck className={className} />;
    case "Clock":
      return <Clock className={className} />;
    default:
      return <Zap className={className} />;
  }
}

export function HomepageSectionsManager() {
  const [sections, setSections] = useState<HomepageSection[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [editingSection, setEditingSection] = useState<HomepageSection | null>(null);
  const [isNewSection, setIsNewSection] = useState(false);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [settingsData, categoriesData] = await Promise.all([
          fetchStoreSettings(),
          fetchCategories(),
        ]);
        setCategories(categoriesData);

        if (
          settingsData.homepage_sections &&
          Array.isArray(settingsData.homepage_sections) &&
          settingsData.homepage_sections.length > 0
        ) {
          // Sort by sort_order
          const sorted = [...settingsData.homepage_sections].sort(
            (a, b) => a.sort_order - b.sort_order
          );
          setSections(sorted);
        } else {
          setSections(DEFAULT_HOMEPAGE_SECTIONS);
        }
      } catch (err) {
        console.error("Failed to load homepage sections:", err);
        setSections(DEFAULT_HOMEPAGE_SECTIONS);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  function showToast(msg: string) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  }

  // Move section Up
  function handleMoveUp(index: number) {
    if (index === 0) return;
    const updated = [...sections];
    const prevSec = updated[index - 1];
    const currSec = updated[index];
    if (!prevSec || !currSec) return;
    updated[index - 1] = currSec;
    updated[index] = prevSec;

    // Re-index sort_order
    updated.forEach((s, idx) => {
      s.sort_order = idx + 1;
    });

    setSections(updated);
    setHasChanges(true);
  }

  // Move section Down
  function handleMoveDown(index: number) {
    if (index === sections.length - 1) return;
    const updated = [...sections];
    const nextSec = updated[index + 1];
    const currSec = updated[index];
    if (!nextSec || !currSec) return;
    updated[index + 1] = currSec;
    updated[index] = nextSec;

    // Re-index sort_order
    updated.forEach((s, idx) => {
      s.sort_order = idx + 1;
    });

    setSections(updated);
    setHasChanges(true);
  }

  // Toggle is_enabled
  function handleToggleEnabled(id: string) {
    const updated = sections.map((s) =>
      s.id === id ? { ...s, is_enabled: !s.is_enabled } : s
    );
    setSections(updated);
    setHasChanges(true);
  }

  // Delete section
  function handleDeleteSection(id: string) {
    const target = sections.find((s) => s.id === id);
    if (!target) return;
    if (!window.confirm(`Are you sure you want to remove the "${target.title}" division from the homepage?`)) {
      return;
    }

    const updated = sections
      .filter((s) => s.id !== id)
      .map((s, idx) => ({ ...s, sort_order: idx + 1 }));

    setSections(updated);
    setHasChanges(true);
    showToast(`Removed "${target.title}" division`);
  }

  // Open modal for editing
  function handleEdit(sec: HomepageSection) {
    setEditingSection({ ...sec });
    setIsNewSection(false);
  }

  // Open modal for new section
  function handleAddNew() {
    const newId = `sec-custom-${Date.now()}`;
    const newSec: HomepageSection = {
      id: newId,
      type: "category",
      category_slug: categories[0]?.slug || "cables",
      title: "Featured Collection",
      title_hi: "विशेष कलेक्शन",
      subtitle: "High-demand mobile accessories with direct wholesale pricing",
      subtitle_hi: "सीधे थोक मूल्य पर उच्च मांग वाले मोबाइल एक्सेसरीज",
      badge_tag: "PREMIUM DROP",
      badge_tag_hi: "प्रीमियर स्टॉक",
      icon: "Zap",
      theme_color: "cyan",
      see_more_url: `/marketplace?category=${categories[0]?.slug || "cables"}`,
      is_enabled: true,
      sort_order: sections.length + 1,
      product_limit: 12,
    };
    setEditingSection(newSec);
    setIsNewSection(true);
  }

  // Save changes from modal
  function handleModalSave() {
    if (!editingSection) return;
    if (!editingSection.title.trim()) {
      alert("Please provide a Title for the division.");
      return;
    }

    if (isNewSection) {
      setSections([...sections, editingSection]);
    } else {
      setSections(sections.map((s) => (s.id === editingSection.id ? editingSection : s)));
    }

    setEditingSection(null);
    setHasChanges(true);
    showToast(`Division "${editingSection.title}" updated.`);
  }

  // Save all to database
  async function handleSaveToDatabase() {
    setSaving(true);
    try {
      await updateStoreSetting("homepage_sections", sections);
      setHasChanges(false);
      showToast("Homepage divisions successfully saved and published live!");
    } catch (err: any) {
      console.error("Save error:", err);
      alert(`Failed to save homepage divisions: ${err?.message || "Unknown error"}`);
    } finally {
      setSaving(false);
    }
  }

  // Reset to factory defaults
  function handleResetToDefaults() {
    if (
      !window.confirm(
        "Are you sure you want to reset all homepage divisions to factory defaults? Any custom divisions will be replaced."
      )
    ) {
      return;
    }
    setSections(DEFAULT_HOMEPAGE_SECTIONS);
    setHasChanges(true);
    showToast("Reset to factory defaults. Click 'Save All Changes' to apply.");
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center space-x-3 text-slate-500">
        <div className="w-5 h-5 border-2 border-brand-dark border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-semibold">Loading homepage divisions...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl flex items-center space-x-2 border border-slate-700 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <Check className="w-4 h-4 text-emerald-400 stroke-3" />
          <span className="text-xs font-bold">{toastMessage}</span>
        </div>
      )}

      {/* Top Header & Action Controls */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-1.5 rounded-lg bg-cyan-100 text-cyan-800">
              <Sliders className="w-4 h-4" />
            </span>
            <h2 className="text-lg font-black text-slate-900 tracking-tight">
              Homepage Divisions &amp; Sliders
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Control every product slider on the storefront homepage (Bestsellers, Fast Cables, Audio, Clearance Deals, New Arrivals). Edit badges, titles in English &amp; Hindi, icons, colors, and order.
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2.5">
          <button
            type="button"
            onClick={handleResetToDefaults}
            className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 active:scale-95 transition cursor-pointer"
            title="Reset to default divisions"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>

          <button
            type="button"
            onClick={handleAddNew}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 active:scale-95 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Division</span>
          </button>

          <button
            type="button"
            onClick={handleSaveToDatabase}
            disabled={saving || !hasChanges}
            className={`inline-flex items-center space-x-2 px-5 py-2 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer ${
              hasChanges
                ? "bg-brand-dark text-white hover:bg-slate-800 active:scale-95 ring-2 ring-brand-dark/20"
                : "bg-slate-200 text-slate-400 cursor-not-allowed"
            }`}
          >
            {saving ? (
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            <span>{hasChanges ? "Save All Changes *" : "Saved to Live"}</span>
          </button>
        </div>
      </div>

      {/* Unsaved Changes Banner */}
      {hasChanges && (
        <div className="bg-amber-50 border border-amber-200 px-4 py-3 rounded-xl flex items-center justify-between text-xs text-amber-900 font-medium">
          <span>You have unsaved changes to homepage divisions. Click &quot;Save All Changes&quot; to apply them to the storefront.</span>
          <button
            type="button"
            onClick={handleSaveToDatabase}
            className="underline font-bold hover:text-amber-950 cursor-pointer"
          >
            Save now
          </button>
        </div>
      )}

      {/* Divisions List */}
      <div className="space-y-3">
        {sections.map((sec, idx) => {
          const themeInfo =
            THEME_OPTIONS.find((t) => t.id === sec.theme_color) || THEME_OPTIONS[0]!;

          return (
            <div
              key={sec.id}
              className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                sec.is_enabled
                  ? "bg-white border-slate-200 shadow-xs hover:border-slate-300"
                  : "bg-slate-50 border-slate-200/70 opacity-65"
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Left: Reorder Controls + Section Details */}
                <div className="flex items-start sm:items-center space-x-3 sm:space-x-4 min-w-0 flex-1">
                  {/* Up / Down Controls */}
                  <div className="flex flex-col items-center space-y-1 shrink-0 pt-0.5 sm:pt-0">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMoveUp(idx)}
                      aria-label="Move Up"
                      className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer transition"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[10px] font-black font-mono text-slate-400">
                      #{idx + 1}
                    </span>
                    <button
                      type="button"
                      disabled={idx === sections.length - 1}
                      onClick={() => handleMoveDown(idx)}
                      aria-label="Move Down"
                      className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer transition"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Icon & Theme Color Box */}
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border shadow-2xs ${themeInfo.badgeClass}`}
                  >
                    {renderSectionIcon(sec.icon, "w-5 h-5")}
                  </div>

                  {/* Section Title, Badges & Subtitle */}
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center flex-wrap gap-2">
                      <h3 className="text-sm font-black text-slate-900 tracking-tight">
                        {sec.title}
                      </h3>
                      {sec.title_hi && (
                        <span className="text-xs font-semibold text-slate-500">
                          ({sec.title_hi})
                        </span>
                      )}

                      {/* Badge Tag Preview */}
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-800 border border-slate-200">
                        {sec.badge_tag}
                      </span>

                      {/* Division Type Pill */}
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        {sec.type === "category"
                          ? `Category: ${sec.category_slug}`
                          : sec.type.toUpperCase()}
                      </span>

                      {/* Product Limit */}
                      <span className="text-[10px] font-bold text-slate-400">
                        • {sec.product_limit || 12} items
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 line-clamp-1">
                      {sec.subtitle}
                    </p>
                    {sec.subtitle_hi && (
                      <p className="text-[11px] text-slate-400 line-clamp-1 italic">
                        {sec.subtitle_hi}
                      </p>
                    )}
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center space-x-2 shrink-0 self-end md:self-center pl-10 md:pl-0">
                  {/* Enable / Disable Button */}
                  <button
                    type="button"
                    onClick={() => handleToggleEnabled(sec.id)}
                    className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                      sec.is_enabled
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                        : "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200"
                    }`}
                  >
                    {sec.is_enabled ? (
                      <>
                        <Eye className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Visible</span>
                      </>
                    ) : (
                      <>
                        <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                        <span>Hidden</span>
                      </>
                    )}
                  </button>

                  {/* Edit Button */}
                  <button
                    type="button"
                    onClick={() => handleEdit(sec)}
                    className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 transition cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>

                  {/* Delete Button */}
                  <button
                    type="button"
                    onClick={() => handleDeleteSection(sec.id)}
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 border border-slate-200 transition cursor-pointer"
                    title="Delete division"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Edit / Create Division Modal ── */}
      {editingSection && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center space-x-2.5">
                <span className="p-2 rounded-xl bg-cyan-100 text-cyan-800">
                  <Sliders className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-base font-black text-slate-900 tracking-tight">
                    {isNewSection ? "Create Homepage Division" : "Edit Homepage Division"}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Customize titles, badge tag, colors, category filter and products limit.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingSection(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              {/* 1. Division Type */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Division Type</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(
                    [
                      { id: "bestsellers", label: "Bestsellers", desc: "Top wholesale margin" },
                      { id: "category", label: "Category Slider", desc: "Filtered by category" },
                      { id: "new_arrivals", label: "New Arrivals", desc: "Latest additions" },
                      { id: "deals", label: "Deals & Clearance", desc: "Price liquidation" },
                    ] as const
                  ).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        const newType = t.id as HomepageSectionType;
                        setEditingSection({
                          ...editingSection,
                          type: newType,
                          see_more_url:
                            newType === "bestsellers"
                              ? "/marketplace?bestseller=1"
                              : newType === "new_arrivals"
                              ? "/marketplace?sort=newest"
                              : newType === "deals"
                              ? "/marketplace?sort=price_asc"
                              : `/marketplace?category=${editingSection.category_slug || "cables"}`,
                        });
                      }}
                      className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                        editingSection.type === t.id
                          ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                          : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      <div className="text-xs font-black">{t.label}</div>
                      <div
                        className={`text-[10px] ${
                          editingSection.type === t.id ? "text-slate-300" : "text-slate-400"
                        }`}
                      >
                        {t.desc}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Category Select (If type === "category") */}
              {editingSection.type === "category" && (
                <div className="space-y-1.5 bg-blue-50/60 border border-blue-200 p-3.5 rounded-2xl">
                  <label className="text-xs font-bold text-blue-900 flex items-center space-x-1.5">
                    <span>Target Category</span>
                  </label>
                  <select
                    value={editingSection.category_slug || ""}
                    onChange={(e) => {
                      const selectedSlug = e.target.value;
                      const selectedCat = categories.find((c) => c.slug === selectedSlug);
                      setEditingSection({
                        ...editingSection,
                        category_slug: selectedSlug,
                        see_more_url: `/marketplace?category=${selectedSlug}`,
                        // Auto-fill title if currently default
                        ...(selectedCat && {
                          title: selectedCat.name,
                        }),
                      });
                    }}
                    className="w-full bg-white border border-blue-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.slug}>
                        {c.name} ({c.slug})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* 3. Title (English & Hindi) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Title (English) *</label>
                  <input
                    type="text"
                    value={editingSection.title}
                    onChange={(e) =>
                      setEditingSection({ ...editingSection, title: e.target.value })
                    }
                    placeholder="e.g. Fast Data & Charging Cables"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-slate-900 focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Title (हिन्दी - Hindi)</label>
                  <input
                    type="text"
                    value={editingSection.title_hi || ""}
                    onChange={(e) =>
                      setEditingSection({ ...editingSection, title_hi: e.target.value })
                    }
                    placeholder="e.g. फ़ास्ट डेटा एवं चार्जिंग केबल्स"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-slate-900 focus:outline-none"
                  />
                </div>
              </div>

              {/* 4. Subtitle (English & Hindi) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Subtitle (English)</label>
                  <input
                    type="text"
                    value={editingSection.subtitle}
                    onChange={(e) =>
                      setEditingSection({ ...editingSection, subtitle: e.target.value })
                    }
                    placeholder="e.g. Braided, silicone, fast charging cables at wholesale rates"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-slate-900 focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Subtitle (हिन्दी - Hindi)</label>
                  <input
                    type="text"
                    value={editingSection.subtitle_hi || ""}
                    onChange={(e) =>
                      setEditingSection({ ...editingSection, subtitle_hi: e.target.value })
                    }
                    placeholder="e.g. ब्रेडेड और सिलिकॉन फ़ास्ट चार्जिंग केबल्स बेजोड़ थोक दरों पर"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-slate-900 focus:outline-none"
                  />
                </div>
              </div>

              {/* 5. Badge Tag (English & Hindi) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Badge Tag (English)</label>
                  <input
                    type="text"
                    value={editingSection.badge_tag}
                    onChange={(e) =>
                      setEditingSection({ ...editingSection, badge_tag: e.target.value })
                    }
                    placeholder="e.g. 100W PD & FAST SYNC"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-slate-900 focus:outline-none uppercase"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Badge Tag (हिन्दी - Hindi)</label>
                  <input
                    type="text"
                    value={editingSection.badge_tag_hi || ""}
                    onChange={(e) =>
                      setEditingSection({ ...editingSection, badge_tag_hi: e.target.value })
                    }
                    placeholder="e.g. 100W PD एवं फ़ास्ट सिंक"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-slate-900 focus:outline-none"
                  />
                </div>
              </div>

              {/* 6. Icon Picker */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Division Icon</label>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                  {AVAILABLE_ICONS.map((ic) => {
                    const isSelected = editingSection.icon === ic.name;
                    return (
                      <button
                        key={ic.name}
                        type="button"
                        onClick={() => setEditingSection({ ...editingSection, icon: ic.name })}
                        className={`p-2.5 rounded-xl border flex flex-col items-center justify-center space-y-1 transition cursor-pointer ${
                          isSelected
                            ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                        }`}
                        title={ic.label}
                      >
                        <ic.icon className="w-4 h-4" />
                        <span className="text-[9px] font-bold truncate max-w-full">
                          {ic.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 7. Theme Color Picker */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Accent Theme Color</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {THEME_OPTIONS.map((th) => {
                    const isSelected = editingSection.theme_color === th.id;
                    return (
                      <button
                        key={th.id}
                        type="button"
                        onClick={() =>
                          setEditingSection({ ...editingSection, theme_color: th.id })
                        }
                        className={`px-3 py-2 rounded-xl border flex items-center space-x-2 transition cursor-pointer text-left ${
                          isSelected
                            ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                            : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        <span className={`w-3 h-3 rounded-full shrink-0 ${th.dotClass}`} />
                        <span className="text-xs font-bold">{th.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 8. See More Target & Product Limit */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">&quot;See More&quot; Target Link</label>
                  <input
                    type="text"
                    value={editingSection.see_more_url}
                    onChange={(e) =>
                      setEditingSection({ ...editingSection, see_more_url: e.target.value })
                    }
                    placeholder="/marketplace?category=cables"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-800 focus:ring-2 focus:ring-slate-900 focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Max Products in Slider</label>
                  <input
                    type="number"
                    min={4}
                    max={48}
                    step={4}
                    value={editingSection.product_limit || 12}
                    onChange={(e) =>
                      setEditingSection({
                        ...editingSection,
                        product_limit: parseInt(e.target.value, 10) || 12,
                      })
                    }
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-slate-900 focus:outline-none"
                  />
                </div>
              </div>

              {/* 9. Visibility Toggle */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Show on Homepage</span>
                  <span className="text-[11px] text-slate-500">
                    If disabled, this slider will be hidden from storefront visitors.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setEditingSection({
                      ...editingSection,
                      is_enabled: !editingSection.is_enabled,
                    })
                  }
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                    editingSection.is_enabled ? "bg-emerald-500" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      editingSection.is_enabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {/* 10. Live Preview Card */}
              <div className="border border-dashed border-slate-300 rounded-2xl p-4 bg-slate-50/50 space-y-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                  Storefront Live Header Preview
                </span>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`p-1.5 rounded-lg border ${
                        THEME_OPTIONS.find((t) => t.id === editingSection.theme_color)?.badgeClass || ""
                      }`}
                    >
                      {renderSectionIcon(editingSection.icon, "w-4 h-4")}
                    </span>
                    <span className="text-sm font-black text-slate-900 tracking-tight">
                      {editingSection.title || "Section Title"}
                    </span>
                    {editingSection.badge_tag && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200/80 text-slate-800 uppercase">
                        {editingSection.badge_tag}
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-bold text-brand-dark flex items-center space-x-1">
                    <span>See More →</span>
                  </span>
                </div>
                <p className="text-xs text-slate-500 line-clamp-1">
                  {editingSection.subtitle || "Section subtitle will appear here"}
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end space-x-2.5 bg-slate-50/50">
              <button
                type="button"
                onClick={() => setEditingSection(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleModalSave}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-brand-dark hover:bg-slate-800 active:scale-95 transition cursor-pointer shadow-xs"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
