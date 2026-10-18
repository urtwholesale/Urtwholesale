import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import type { Banner } from "@urbanrat/shared";
import { Save, Check, Loader2 } from "lucide-react";

export function BannersEditor() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadBanners() {
    try {
      setLoading(true);
      const { data, error: err } = await supabase
        .from("banners")
        .select("*")
        .order("sort_order", { ascending: true });

      if (err) throw err;
      setBanners((data as Banner[]) || []);
    } catch (err: unknown) {
      const e = err as Error;
      console.error("Failed to load banners:", e);
      setError(e.message || "Failed to load banners");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBanners();
  }, []);

  function handleBannerChange(id: string, field: keyof Banner, value: unknown) {
    setBanners((prev) =>
      prev.map((b) => (b.id === id ? { ...b, [field]: value } : b))
    );
  }

  async function handleSaveBanner(banner: Banner) {
    setSavingId(banner.id);
    setError(null);
    try {
      const { error: err } = await supabase
        .from("banners")
        .update({
          title: banner.title,
          subtitle: banner.subtitle,
          badge_text: banner.badge_text,
          image_url: banner.image_url,
          cta_text: banner.cta_text,
          cta_link: banner.cta_link,
          secondary_cta_text: banner.secondary_cta_text,
          secondary_cta_link: banner.secondary_cta_link,
          placement: banner.placement,
          is_active: banner.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq("id", banner.id);

      if (err) throw err;

      setSavedId(banner.id);
      setTimeout(() => setSavedId(null), 2500);
    } catch (err: unknown) {
      const e = err as Error;
      console.error("Failed to update banner:", e);
      setError(e.message || "Failed to update banner");
    } finally {
      setSavingId(null);
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 p-8 shadow-sm text-center">
        <Loader2 className="w-6 h-6 text-[#0A82A8] animate-spin mx-auto mb-2" />
        <p className="text-xs text-slate-400">Loading promotional banners...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Promotional Banners</h2>
          <p className="text-xs text-slate-500">
            Edit hero headlines, brand spotlights, and promotional CTA buttons
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
          {error}
        </div>
      )}

      <div className="space-y-6">
        {banners.map((banner) => (
          <div
            key={banner.id}
            className="p-5 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-4"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#0A82A8] bg-[#5ADBE5]/15 px-2.5 py-0.5 rounded-full border border-[#5ADBE5]/30">
                Placement: {banner.placement}
              </span>
              <div className="flex items-center space-x-2">
                <label className="text-xs text-slate-600 font-medium flex items-center space-x-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={banner.is_active}
                    onChange={(e) =>
                      handleBannerChange(banner.id, "is_active", e.target.checked)
                    }
                    className="rounded text-[#0A82A8]"
                  />
                  <span>Active</span>
                </label>
                {savedId === banner.id && (
                  <span className="text-[11px] font-bold text-emerald-600 flex items-center space-x-1">
                    <Check className="w-3 h-3" />
                    <span>Saved</span>
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Banner Headline
                </label>
                <input
                  type="text"
                  value={banner.title}
                  onChange={(e) =>
                    handleBannerChange(banner.id, "title", e.target.value)
                  }
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#0A82A8]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Badge Text (Top Pill)
                </label>
                <input
                  type="text"
                  value={banner.badge_text}
                  onChange={(e) =>
                    handleBannerChange(banner.id, "badge_text", e.target.value)
                  }
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#0A82A8]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Subtitle Description
              </label>
              <textarea
                rows={2}
                value={banner.subtitle}
                onChange={(e) =>
                  handleBannerChange(banner.id, "subtitle", e.target.value)
                }
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#0A82A8]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  CTA Button Label
                </label>
                <input
                  type="text"
                  value={banner.cta_text}
                  onChange={(e) =>
                    handleBannerChange(banner.id, "cta_text", e.target.value)
                  }
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#0A82A8]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  CTA Link Destination
                </label>
                <input
                  type="text"
                  value={banner.cta_link}
                  onChange={(e) =>
                    handleBannerChange(banner.id, "cta_link", e.target.value)
                  }
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#0A82A8]"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                disabled={savingId === banner.id}
                onClick={() => handleSaveBanner(banner)}
                className="py-1.5 px-4 rounded-xl text-white font-semibold text-xs transition active:scale-95 shadow-xs cursor-pointer flex items-center space-x-1.5"
                style={{
                  background: "linear-gradient(to bottom, #5ADBE5, #0A82A8)",
                }}
              >
                {savingId === banner.id ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3 h-3" />
                    <span>Update Banner</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
