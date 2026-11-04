import React, { useState, useEffect, useCallback } from "react";
import type { MarqueeAnnouncement, MarqueeAnnouncementInput } from "@urbanrat/shared";
import {
  fetchAdminMarqueeAnnouncements,
  createMarqueeAnnouncement,
  updateMarqueeAnnouncement,
  deleteMarqueeAnnouncement,
} from "../../lib/adminService";
import {
  Sparkles,
  BadgePercent,
  Truck,
  Zap,
  ShieldCheck,
  Flame,
  PackageCheck,
  Layers,
  Award,
  Tag,
  Percent,
  Clock,
  Gift,
  Star,
  CheckCircle2,
  Headphones,
  BatteryCharging,
  Plus,
  Trash2,
  Save,
  Check,
  AlertCircle,
  Loader2,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Link as LinkIcon,
  RefreshCw,
  Sliders,
} from "lucide-react";

// Lucide icon dictionary for marquee announcements
export const ICON_OPTIONS: Array<{
  name: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { name: "BadgePercent", label: "Discount / Margin", icon: BadgePercent },
  { name: "Truck", label: "Delivery / Shipping", icon: Truck },
  { name: "Zap", label: "Express / Fast", icon: Zap },
  { name: "ShieldCheck", label: "Trust / Warranty", icon: ShieldCheck },
  { name: "Flame", label: "Hot Deal / Direct", icon: Flame },
  { name: "PackageCheck", label: "Low MOQ / Lots", icon: PackageCheck },
  { name: "Layers", label: "Catalog / Stock", icon: Layers },
  { name: "Sparkles", label: "Premium / Dealer", icon: Sparkles },
  { name: "Award", label: "Quality / ISO", icon: Award },
  { name: "Tag", label: "Price / Offer", icon: Tag },
  { name: "Percent", label: "Percentage Off", icon: Percent },
  { name: "Clock", label: "24-Hour Dispatch", icon: Clock },
  { name: "Gift", label: "Freebie / Bonus", icon: Gift },
  { name: "Star", label: "Top Rated", icon: Star },
  { name: "CheckCircle2", label: "Inspected / Verified", icon: CheckCircle2 },
  { name: "Headphones", label: "Audio Gear", icon: Headphones },
  { name: "BatteryCharging", label: "Power & Cables", icon: BatteryCharging },
];

const PRESET_TEMPLATES: Array<{
  label: string;
  badge: string;
  title: string;
  subtitle: string;
  icon: string;
  link_url: string;
}> = [
  {
    label: "Wholesale Tiers",
    badge: "WHOLESALE TIERS",
    title: "UP TO 35% BULK SAVINGS",
    subtitle: "Automatic tier volume discounts on 100+ pcs",
    icon: "BadgePercent",
    link_url: "/marketplace",
  },
  {
    label: "Free Delivery",
    badge: "FREE DELIVERY",
    title: "₹0 SHIPPING ON ORDERS ₹999+",
    subtitle: "Pan-India express logistics across all states",
    icon: "Truck",
    link_url: "/marketplace",
  },
  {
    label: "Express Dispatch",
    badge: "EXPRESS DISPATCH",
    title: "SAME-DAY 24H DISPATCH",
    subtitle: "Direct surface & air cargo via SafeXpress / Delhivery",
    icon: "Zap",
    link_url: "/marketplace",
  },
  {
    label: "Replacement Warranty",
    badge: "URT PROMISE",
    title: "1-YEAR REPLACEMENT WARRANTY",
    subtitle: "100% Quality Inspected • Instant DOA replacement",
    icon: "ShieldCheck",
    link_url: "/about",
  },
  {
    label: "Factory Direct",
    badge: "DIRECT PRICING",
    title: "FACTORY-DIRECT WHOLESALE",
    subtitle: "Zero middlemen commissions • Maximum retail shop profit",
    icon: "Flame",
    link_url: "/marketplace",
  },
  {
    label: "Low MOQ",
    badge: "LOW MOQ",
    title: "START FROM JUST 10 PIECES",
    subtitle: "Flexible wholesale lot sizes for shop retailers",
    icon: "PackageCheck",
    link_url: "/marketplace",
  },
];

export function MarqueeManager() {
  const [items, setItems] = useState<MarqueeAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dbNotice, setDbNotice] = useState<string | null>(null);

  // New item form state
  const [showNewForm, setShowNewForm] = useState(false);
  const [newBadge, setNewBadge] = useState("WHOLESALE TIERS");
  const [newTitle, setNewTitle] = useState("");
  const [newSubtitle, setNewSubtitle] = useState("");
  const [newIcon, setNewIcon] = useState("BadgePercent");
  const [newLinkUrl, setNewLinkUrl] = useState("/marketplace");

  function showToast(msg: string) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  }

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    setDbNotice(null);
    try {
      const data = await fetchAdminMarqueeAnnouncements();
      setItems(data);
    } catch (err: any) {
      console.warn("Failed to fetch marquee announcements:", err);
      if (err?.code === "PGRST205" || err?.message?.includes("marquee_announcements")) {
        setDbNotice(
          "Table public.marquee_announcements is not created yet. Apply migration 028_marquee_announcements.sql in Supabase SQL editor."
        );
      } else {
        setError(err?.message || "Failed to load marquee announcements.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  // Handle local state updates before persisting
  function handleItemFieldChange(
    id: string,
    field: keyof MarqueeAnnouncement,
    val: any
  ) {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: val } : item))
    );
  }

  // Toggle active status
  async function handleToggleActive(item: MarqueeAnnouncement) {
    const updatedStatus = !item.is_active;
    handleItemFieldChange(item.id, "is_active", updatedStatus);
    setSavingId(item.id);
    setError(null);
    try {
      await updateMarqueeAnnouncement({ id: item.id, is_active: updatedStatus });
      showToast(
        updatedStatus
          ? `Activated "${item.title || item.badge}"`
          : `Deactivated "${item.title || item.badge}"`
      );
    } catch (err: any) {
      // Revert on failure
      handleItemFieldChange(item.id, "is_active", item.is_active);
      setError(err?.message || "Failed to update announcement status.");
    } finally {
      setSavingId(null);
    }
  }

  // Save single item
  async function handleSaveItem(item: MarqueeAnnouncement) {
    setSavingId(item.id);
    setError(null);
    try {
      await updateMarqueeAnnouncement(item);
      showToast(`Saved "${item.title || item.badge}" successfully!`);
    } catch (err: any) {
      console.error("Save marquee announcement error:", err);
      setError(err?.message || "Failed to save announcement.");
    } finally {
      setSavingId(null);
    }
  }

  // Delete item
  async function handleDeleteItem(id: string, title: string) {
    if (!window.confirm(`Are you sure you want to delete "${title || "this announcement"}"?`)) {
      return;
    }
    setDeletingId(id);
    setError(null);
    try {
      await deleteMarqueeAnnouncement(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
      showToast("Announcement deleted.");
    } catch (err: any) {
      console.error("Delete announcement error:", err);
      setError(err?.message || "Failed to delete announcement.");
    } finally {
      setDeletingId(null);
    }
  }

  // Reorder items (swap sort orders)
  async function handleMove(index: number, direction: "up" | "down") {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;

    const current = items[index];
    const target = items[targetIndex];
    if (!current || !target) return;

    const currentOrder = current.sort_order;
    const targetOrder =
      target.sort_order === currentOrder
        ? direction === "up"
          ? currentOrder - 1
          : currentOrder + 1
        : target.sort_order;

    // Optimistic reorder
    const reordered = [...items];
    reordered[index] = { ...target, sort_order: currentOrder };
    reordered[targetIndex] = { ...current, sort_order: targetOrder };
    setItems(reordered);

    try {
      await Promise.all([
        updateMarqueeAnnouncement({ id: current.id, sort_order: targetOrder }),
        updateMarqueeAnnouncement({ id: target.id, sort_order: currentOrder }),
      ]);
      showToast("Order updated.");
    } catch (err: any) {
      console.error("Reorder failed:", err);
      loadItems(); // rollback from DB
    }
  }

  // Create new item
  async function handleCreateItem(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) {
      setError("Please provide a title for the announcement.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const payload: MarqueeAnnouncementInput = {
        badge: newBadge.trim() || "WHOLESALE",
        title: newTitle.trim(),
        subtitle: newSubtitle.trim(),
        icon: newIcon,
        link_url: newLinkUrl.trim() || null,
        sort_order: items.length > 0 ? Math.max(...items.map((i) => i.sort_order)) + 1 : 1,
        is_active: true,
      };
      const created = await createMarqueeAnnouncement(payload);
      setItems((prev) => [...prev, created]);
      setShowNewForm(false);
      setNewTitle("");
      setNewSubtitle("");
      setNewBadge("WHOLESALE TIERS");
      setNewIcon("BadgePercent");
      setNewLinkUrl("/marketplace");
      showToast("✨ New marquee announcement added!");
    } catch (err: any) {
      console.error("Create marquee announcement error:", err);
      setError(err?.message || "Failed to create announcement.");
    } finally {
      setCreating(false);
    }
  }

  // Apply a preset template to the new item form
  function applyTemplate(tpl: (typeof PRESET_TEMPLATES)[number]) {
    setNewBadge(tpl.badge);
    setNewTitle(tpl.title);
    setNewSubtitle(tpl.subtitle);
    setNewIcon(tpl.icon);
    setNewLinkUrl(tpl.link_url);
    setShowNewForm(true);
  }

  // Helper to render icon preview
  function renderIconPreview(iconName: string, className = "w-4 h-4") {
    const opt = ICON_OPTIONS.find((o) => o.name === iconName);
    if (!opt) return <Sparkles className={className} />;
    const IconComp = opt.icon;
    return <IconComp className={className} />;
  }

  return (
    <div className="space-y-6">
      {/* ── Sub-header Actions & Status ── */}
      <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center space-x-2">
              <span className="p-1.5 rounded-lg bg-brand/10 text-brand-dark">
                <Sliders className="w-4 h-4" />
              </span>
              <span>Continuous Marquee Announcements &amp; Offers</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Configure the edge-to-edge ticker lines displayed on the customer storefront.
              Changes appear immediately in the live feed.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={loadItems}
              disabled={loading}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>

            <button
              type="button"
              onClick={() => setShowNewForm((prev) => !prev)}
              className="inline-flex items-center space-x-1.5 px-4 py-1.5 rounded-xl text-xs font-bold text-white bg-brand-dark hover:bg-brand transition shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{showNewForm ? "Close Form" : "Add Announcement"}</span>
            </button>
          </div>
        </div>

        {/* Feedback Alerts */}
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900">
            <div className="flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
              <div>
                <p className="font-bold">Database Migration Required (028)</p>
                <p className="text-amber-700 mt-0.5">{dbNotice}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={loadItems}
              className="self-start sm:self-auto px-3 py-1 bg-amber-200 hover:bg-amber-300 text-amber-900 rounded-lg font-bold text-xs transition cursor-pointer"
            >
              Check Again
            </button>
          </div>
        )}
      </div>

      {/* ── Live Storefront Preview Strip ── */}
      <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">
              Live Storefront Preview ({items.filter((i) => i.is_active).length} Active Lines)
            </h4>
          </div>
          <span className="text-[11px] font-semibold text-slate-400">
            Hover to pause scroll
          </span>
        </div>

        {/* Scrolling preview container */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/80 p-2">
          {items.filter((i) => i.is_active).length === 0 ? (
            <div className="py-4 text-center text-xs text-slate-400 font-medium">
              No active announcements. Activate at least one line to display on storefront.
            </div>
          ) : (
            <div className="flex animate-marquee-scroll hover:[animation-play-state:paused] items-center space-x-8 py-2 overflow-x-hidden">
              {items
                .filter((i) => i.is_active)
                .map((item) => (
                  <div
                    key={`preview-${item.id}`}
                    className="flex items-center space-x-3 shrink-0 px-2"
                  >
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-brand/10 border border-brand/20 text-brand-dark shrink-0">
                      {renderIconPreview(item.icon, "w-3.5 h-3.5")}
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center space-x-2">
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-brand-light/30 text-brand-dark border border-brand/20 leading-none">
                          {item.badge}
                        </span>
                        <span className="text-xs font-black text-slate-900 whitespace-nowrap">
                          {item.title}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-medium whitespace-nowrap mt-0.5">
                        {item.subtitle}
                      </span>
                    </div>
                    <span className="text-brand opacity-40 font-black text-xs pl-4">✦</span>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Preset Starter Templates ── */}
      <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs space-y-3">
        <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">
          Quick Offer Templates
        </h4>
        <div className="flex flex-wrap gap-2">
          {PRESET_TEMPLATES.map((tpl) => (
            <button
              key={tpl.label}
              type="button"
              onClick={() => applyTemplate(tpl)}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-50 hover:bg-brand/10 hover:text-brand-dark text-slate-700 border border-slate-200/80 transition cursor-pointer"
            >
              {renderIconPreview(tpl.icon, "w-3 h-3 text-brand-dark")}
              <span>+ {tpl.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── New Announcement Form (Collapsible) ── */}
      {showNewForm && (
        <form
          onSubmit={handleCreateItem}
          className="bg-white p-5 sm:p-6 rounded-3xl border-2 border-brand/30 shadow-sm space-y-4"
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h4 className="text-sm font-black text-slate-900 tracking-tight flex items-center space-x-2">
              <Plus className="w-4 h-4 text-brand-dark" />
              <span>Create New Announcement Line</span>
            </h4>
            <button
              type="button"
              onClick={() => setShowNewForm(false)}
              className="text-slate-400 hover:text-slate-600 text-xs font-bold"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Badge */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Badge Text
              </label>
              <input
                type="text"
                required
                value={newBadge}
                onChange={(e) => setNewBadge(e.target.value.toUpperCase())}
                placeholder="e.g. WHOLESALE TIERS, FREE DELIVERY"
                className="w-full px-3 py-2 text-xs font-bold uppercase rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand/50"
              />
            </div>

            {/* Title */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Headline / Title
              </label>
              <input
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. UP TO 35% BULK SAVINGS"
                className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand/50"
              />
            </div>

            {/* Subtitle */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Subtitle / Description
              </label>
              <input
                type="text"
                value={newSubtitle}
                onChange={(e) => setNewSubtitle(e.target.value)}
                placeholder="e.g. Automatic tier volume discounts on 100+ pcs"
                className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand/50"
              />
            </div>

            {/* Icon Picker */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Icon
              </label>
              <div className="flex items-center space-x-2">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-brand/10 border border-brand/20 text-brand-dark shrink-0">
                  {renderIconPreview(newIcon, "w-4 h-4")}
                </div>
                <select
                  value={newIcon}
                  onChange={(e) => setNewIcon(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand/50 bg-white"
                >
                  {ICON_OPTIONS.map((opt) => (
                    <option key={opt.name} value={opt.name}>
                      {opt.label} ({opt.name})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Link URL */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Link URL (Optional Destination)
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={newLinkUrl}
                  onChange={(e) => setNewLinkUrl(e.target.value)}
                  placeholder="e.g. /marketplace, /about, /dealer, or https://..."
                  className="w-full pl-8 pr-3 py-2 text-xs font-medium rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand/50"
                />
                <LinkIcon className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={creating}
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-brand-dark hover:bg-brand transition shadow-sm cursor-pointer disabled:opacity-50"
            >
              {creating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Adding to Database...</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>Save Announcement to Database</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* ── Table of Marquee Announcements ── */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h4 className="text-sm font-black text-slate-900 tracking-tight">
            Manage Announcement Lines ({items.length})
          </h4>
          <span className="text-xs text-slate-400">
            Use arrows to reorder lines in the continuous loop
          </span>
        </div>

        {loading ? (
          <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center space-y-2">
            <Loader2 className="w-6 h-6 animate-spin text-brand" />
            <span className="text-xs font-semibold">Loading marquee announcements...</span>
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center text-slate-400 space-y-3">
            <p className="text-xs font-medium">No announcements found in database.</p>
            <button
              type="button"
              onClick={() => setShowNewForm(true)}
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-brand-dark hover:bg-brand transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create First Announcement</span>
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map((item, index) => {
              const isSaving = savingId === item.id;
              const isDeleting = deletingId === item.id;

              return (
                <div
                  key={item.id}
                  className={`p-4 sm:p-5 transition-colors ${
                    item.is_active ? "bg-white hover:bg-slate-50/50" : "bg-slate-50/60 opacity-75"
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Reorder and Status Column */}
                    <div className="flex items-center space-x-2 shrink-0">
                      {/* Sort Order Badge */}
                      <span className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 text-xs font-black flex items-center justify-center">
                        #{index + 1}
                      </span>

                      {/* Up/Down buttons */}
                      <div className="flex flex-col space-y-1">
                        <button
                          type="button"
                          onClick={() => handleMove(index, "up")}
                          disabled={index === 0}
                          title="Move Up"
                          className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 disabled:opacity-30 cursor-pointer"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMove(index, "down")}
                          disabled={index === items.length - 1}
                          title="Move Down"
                          className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 disabled:opacity-30 cursor-pointer"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Active Status Toggle */}
                      <button
                        type="button"
                        onClick={() => handleToggleActive(item)}
                        disabled={isSaving}
                        className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold border transition cursor-pointer ${
                          item.is_active
                            ? "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
                            : "bg-slate-200 text-slate-600 border-slate-300 hover:bg-slate-300"
                        }`}
                      >
                        {item.is_active ? (
                          <>
                            <Eye className="w-3 h-3" />
                            <span>Active</span>
                          </>
                        ) : (
                          <>
                            <EyeOff className="w-3 h-3" />
                            <span>Hidden</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Editable Fields Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 flex-1">
                      {/* Badge Text */}
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">
                          Badge
                        </label>
                        <input
                          type="text"
                          value={item.badge}
                          onChange={(e) =>
                            handleItemFieldChange(item.id, "badge", e.target.value.toUpperCase())
                          }
                          className="w-full px-2.5 py-1.5 text-xs font-black uppercase rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand"
                        />
                      </div>

                      {/* Title */}
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">
                          Title
                        </label>
                        <input
                          type="text"
                          value={item.title}
                          onChange={(e) =>
                            handleItemFieldChange(item.id, "title", e.target.value)
                          }
                          className="w-full px-2.5 py-1.5 text-xs font-bold text-slate-900 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand"
                        />
                      </div>

                      {/* Subtitle */}
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">
                          Subtitle
                        </label>
                        <input
                          type="text"
                          value={item.subtitle}
                          onChange={(e) =>
                            handleItemFieldChange(item.id, "subtitle", e.target.value)
                          }
                          className="w-full px-2.5 py-1.5 text-xs font-medium text-slate-600 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand"
                        />
                      </div>

                      {/* Icon Selector */}
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">
                          Icon
                        </label>
                        <div className="flex items-center space-x-1.5">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-brand/10 border border-brand/20 text-brand-dark shrink-0">
                            {renderIconPreview(item.icon, "w-3.5 h-3.5")}
                          </div>
                          <select
                            value={item.icon}
                            onChange={(e) =>
                              handleItemFieldChange(item.id, "icon", e.target.value)
                            }
                            className="w-full px-2 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand bg-white"
                          >
                            {ICON_OPTIONS.map((opt) => (
                              <option key={opt.name} value={opt.name}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Link Destination */}
                      <div className="sm:col-span-2 xl:col-span-4">
                        <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">
                          Link URL (e.g. /marketplace or /urbanrat)
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={item.link_url || ""}
                            onChange={(e) =>
                              handleItemFieldChange(item.id, "link_url", e.target.value)
                            }
                            placeholder="Optional URL target..."
                            className="w-full pl-7 pr-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand"
                          />
                          <LinkIcon className="w-3 h-3 text-slate-400 absolute left-2 top-2" />
                        </div>
                      </div>
                    </div>

                    {/* Actions Column */}
                    <div className="flex items-center space-x-2 shrink-0 self-end lg:self-center">
                      <button
                        type="button"
                        onClick={() => handleSaveItem(item)}
                        disabled={isSaving}
                        className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-brand-dark hover:bg-brand transition shadow-2xs cursor-pointer disabled:opacity-50"
                      >
                        {isSaving ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Save className="w-3.5 h-3.5" />
                        )}
                        <span>Save</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteItem(item.id, item.title)}
                        disabled={isDeleting}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                        title="Delete Announcement"
                      >
                        {isDeleting ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-500" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
