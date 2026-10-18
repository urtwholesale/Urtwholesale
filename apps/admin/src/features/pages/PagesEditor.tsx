import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import type { StorePage } from "@urbanrat/shared";
import { Save, Check, Loader2 } from "lucide-react";

export function PagesEditor() {
  const [pages, setPages] = useState<StorePage[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string>("about");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedToast, setSavedToast] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadPages() {
    try {
      setLoading(true);
      const { data, error: err } = await supabase
        .from("store_pages")
        .select("*");

      if (err) throw err;
      const loaded = (data as StorePage[]) || [];
      setPages(loaded);
      if (loaded.length > 0 && !selectedSlug) {
        setSelectedSlug(loaded[0]!.slug);
      }
    } catch (err: unknown) {
      const e = err as Error;
      console.error("Failed to load store pages:", e);
      setError(e.message || "Failed to load store pages");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPages();
  }, []);

  const currentPage = pages.find((p) => p.slug === selectedSlug);

  function handleCurrentPageChange(field: keyof StorePage, value: string) {
    setPages((prev) =>
      prev.map((p) => (p.slug === selectedSlug ? { ...p, [field]: value } : p))
    );
  }

  async function handleSaveCurrentPage(e: React.FormEvent) {
    e.preventDefault();
    if (!currentPage) return;

    setSaving(true);
    setError(null);

    try {
      const { error: err } = await supabase
        .from("store_pages")
        .upsert({
          slug: currentPage.slug,
          title: currentPage.title,
          summary: currentPage.summary,
          content: currentPage.content,
          updated_at: new Date().toISOString(),
        });

      if (err) throw err;

      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 2500);
    } catch (err: unknown) {
      const e = err as Error;
      console.error("Save page error:", e);
      setError(e.message || "Failed to save page");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 p-8 shadow-sm text-center">
        <Loader2 className="w-6 h-6 text-[#0A82A8] animate-spin mx-auto mb-2" />
        <p className="text-xs text-slate-400">Loading informational pages...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Legal &amp; Policy Pages</h2>
          <p className="text-xs text-slate-500">
            Edit content for About Us, Warranty Terms, and Privacy Policy
          </p>
        </div>
        {savedToast && (
          <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Check className="w-3.5 h-3.5" />
            <span>Saved to Database!</span>
          </span>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-slate-100 pb-2">
        {pages.map((p) => (
          <button
            key={p.slug}
            type="button"
            onClick={() => setSelectedSlug(p.slug)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              selectedSlug === p.slug
                ? "bg-[#5ADBE5]/20 text-[#0A82A8] border border-[#5ADBE5]/40"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            {p.slug.toUpperCase()}
          </button>
        ))}
      </div>

      {currentPage && (
        <form onSubmit={handleSaveCurrentPage} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Page Title
            </label>
            <input
              type="text"
              required
              value={currentPage.title}
              onChange={(e) => handleCurrentPageChange("title", e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#0A82A8] focus:bg-white transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Short Summary
            </label>
            <input
              type="text"
              value={currentPage.summary}
              onChange={(e) => handleCurrentPageChange("summary", e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#0A82A8] focus:bg-white transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Page Content
            </label>
            <textarea
              rows={8}
              required
              value={currentPage.content}
              onChange={(e) => handleCurrentPageChange("content", e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#0A82A8] focus:bg-white transition leading-relaxed"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Plain text or markdown paragraphs. Changes update instantly on the customer Account &amp; Menu page.
            </p>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="py-2.5 px-6 rounded-xl text-white font-semibold text-xs transition active:scale-95 shadow-sm cursor-pointer disabled:opacity-60 flex items-center space-x-2"
              style={{
                background: "linear-gradient(to bottom, #5ADBE5, #0A82A8)",
              }}
            >
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving to Supabase...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Page Content</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
