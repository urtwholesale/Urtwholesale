import { useState, useRef, useEffect } from "react";
import {
  Upload,
  Download,
  Zap,
  Check,
  RefreshCw,
  ExternalLink,
  Copy,
  Sliders,
  Sparkles,
} from "lucide-react";
import {
  compressImage,
  type CompressionResult,
} from "../../utils/imageCompressor";
import { supabase } from "../../lib/supabase";

export function ImageCompressorTool() {
  const [file, setFile] = useState<File | null>(null);
  const [previewOriginalUrl, setPreviewOriginalUrl] = useState<string | null>(null);
  const [previewCompressedUrl, setPreviewCompressedUrl] = useState<string | null>(null);
  const [result, setResult] = useState<CompressionResult | null>(null);
  const [compressing, setCompressing] = useState(false);

  // Settings
  const [quality, setQuality] = useState<number>(0.82);
  const [maxWidth, setMaxWidth] = useState<number>(1600);
  const [mimeType, setMimeType] = useState<"image/webp" | "image/jpeg">("image/webp");

  // Upload to Supabase state
  const [uploadingToStorage, setUploadingToStorage] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clean up object URLs when unmounting or changing
  useEffect(() => {
    return () => {
      if (previewOriginalUrl) URL.revokeObjectURL(previewOriginalUrl);
      if (previewCompressedUrl) URL.revokeObjectURL(previewCompressedUrl);
    };
  }, [previewOriginalUrl, previewCompressedUrl]);

  async function processCompression(selectedFile: File) {
    setCompressing(true);
    setUploadedUrl(null);
    setCopied(false);

    // Set original preview
    if (previewOriginalUrl) URL.revokeObjectURL(previewOriginalUrl);
    const origUrl = URL.createObjectURL(selectedFile);
    setPreviewOriginalUrl(origUrl);

    try {
      const compResult = await compressImage(selectedFile, {
        maxWidth,
        maxHeight: maxWidth,
        quality,
        mimeType,
      });

      setResult(compResult);

      if (previewCompressedUrl) URL.revokeObjectURL(previewCompressedUrl);
      const compUrl = URL.createObjectURL(compResult.file);
      setPreviewCompressedUrl(compUrl);
    } catch (err) {
      console.error("Compression error:", err);
    } finally {
      setCompressing(false);
    }
  }

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    processCompression(selected);
  }

  function handleRecompress() {
    if (file) {
      processCompression(file);
    }
  }

  function handleDownload() {
    if (!result || !previewCompressedUrl) return;
    const a = document.createElement("a");
    a.href = previewCompressedUrl;
    a.download = result.file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  async function handleUploadToStorage() {
    if (!result) return;
    setUploadingToStorage(true);

    try {
      const ext = result.file.name.split(".").pop() || "webp";
      const uniqueName = `optimized_${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("banners")
        .upload(uniqueName, result.file, {
          contentType: result.file.type,
          cacheControl: "31536000",
          upsert: false,
        });

      let bucket = "banners";
      if (uploadError) {
        const { error: fallbackErr } = await supabase.storage
          .from("product-images")
          .upload(uniqueName, result.file, {
            contentType: result.file.type,
            cacheControl: "31536000",
            upsert: false,
          });
        if (fallbackErr) throw uploadError;
        bucket = "product-images";
      }

      const { data } = supabase.storage.from(bucket).getPublicUrl(uniqueName);
      setUploadedUrl(data.publicUrl);
    } catch (err: any) {
      console.error("Storage upload failed:", err);
      alert(err?.message || "Failed to upload to Supabase storage");
    } finally {
      setUploadingToStorage(false);
    }
  }

  function handleCopyUrl() {
    if (!uploadedUrl) return;
    navigator.clipboard.writeText(uploadedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-6">
      {/* ── Intro Callout Card ── */}
      <div className="bg-gradient-to-br from-cyan-50 via-white to-sky-50 border border-cyan-200/80 p-5 rounded-3xl shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start space-x-3.5">
            <div className="w-10 h-10 rounded-2xl bg-[#0A82A8] text-white flex items-center justify-center shrink-0 shadow-xs">
              <Zap className="w-5 h-5 fill-current" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                  Instant Image Compressor &amp; WebP Optimizer
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800">
                  Built-in
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                Compresses banners and product photos in your browser before upload. WebP delivers 70%–95% smaller payloads with zero visible quality loss so your customer storefront paints in milliseconds.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Compression Tuning Controls ── */}
      <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs space-y-4">
        <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
          <Sliders className="w-4 h-4 text-[#0A82A8]" />
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">
            Compression &amp; Dimensions Settings
          </h4>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Quality Slider */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700">
                Quality: {Math.round(quality * 100)}%
              </label>
              <span className="text-[10px] text-slate-400 font-semibold">
                {quality >= 0.85 ? "High Fidelity" : quality >= 0.75 ? "Balanced (Recommended)" : "Maximum Speed"}
              </span>
            </div>
            <input
              type="range"
              min="0.5"
              max="0.95"
              step="0.05"
              value={quality}
              onChange={(e) => setQuality(parseFloat(e.target.value))}
              className="w-full accent-[#0A82A8] cursor-pointer"
            />
          </div>

          {/* Max Width Presets */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 block">
              Max Dimensions: {maxWidth}px
            </label>
            <div className="flex items-center gap-1.5">
              {[800, 1200, 1600, 1920].map((dim) => (
                <button
                  key={dim}
                  type="button"
                  onClick={() => setMaxWidth(dim)}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition cursor-pointer ${
                    maxWidth === dim
                      ? "bg-[#0A82A8] text-white shadow-2xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {dim}px
                </button>
              ))}
            </div>
          </div>

          {/* Format Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 block">
              Target Output Format
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMimeType("image/webp")}
                className={`flex-1 py-1 px-3 rounded-xl text-xs font-bold transition cursor-pointer ${
                  mimeType === "image/webp"
                    ? "bg-[#0A82A8] text-white shadow-2xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                WebP (95% smaller)
              </button>
              <button
                type="button"
                onClick={() => setMimeType("image/jpeg")}
                className={`flex-1 py-1 px-3 rounded-xl text-xs font-bold transition cursor-pointer ${
                  mimeType === "image/jpeg"
                    ? "bg-[#0A82A8] text-white shadow-2xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                JPEG
              </button>
            </div>
          </div>
        </div>

        {file && (
          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={handleRecompress}
              disabled={compressing}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${compressing ? "animate-spin" : ""}`} />
              <span>Apply New Settings</span>
            </button>
          </div>
        )}
      </div>

      {/* ── Dropzone / File Picker ── */}
      <div
        onClick={() => fileInputRef.current?.click()}
        className="p-8 border-2 border-dashed border-slate-300 hover:border-[#5ADBE5] rounded-3xl bg-white hover:bg-slate-50/60 transition cursor-pointer text-center group shadow-xs"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelected}
          className="hidden"
        />

        <div className="w-14 h-14 rounded-2xl bg-cyan-50 group-hover:bg-cyan-100 border border-cyan-100 flex items-center justify-center text-[#0A82A8] mx-auto mb-3 transition-colors shadow-2xs">
          <Upload className="w-6 h-6 stroke-[2.2]" />
        </div>

        <h4 className="text-sm font-bold text-slate-900">
          Drop any image here or click to select
        </h4>
        <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
          Supports JPG, PNG, WebP, AVIF, or HEIC. Automatically converts and resizes for lightning-fast delivery.
        </p>
      </div>

      {/* ── Compression Comparison & Results ── */}
      {result && file && (
        <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-100 shadow-xs space-y-6 animate-in fade-in duration-300">
          {/* Header Stats Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-black text-slate-900">
                  Compressed from {result.formattedOriginalSize} down to {result.formattedCompressedSize}
                </p>
                <p className="text-[11px] text-slate-500">
                  Optimized to {result.width}×{result.height}px WebP format
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs">
                ⚡ {result.savingsPercent}% Space Saved
              </span>
            </div>
          </div>

          {/* Side-by-Side Preview */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Original Card */}
            <div className="space-y-2 border border-slate-200/80 rounded-2xl p-3.5 bg-slate-50/50">
              <div className="flex items-center justify-between text-xs">
                <span className="font-extrabold text-slate-700">Original Raw Image</span>
                <span className="text-slate-500 font-bold">{result.formattedOriginalSize}</span>
              </div>
              <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-200 border border-slate-200 flex items-center justify-center">
                {previewOriginalUrl && (
                  <img
                    src={previewOriginalUrl}
                    alt="Original raw"
                    className="w-full h-full object-contain"
                  />
                )}
              </div>
              <p className="text-[10px] text-slate-400 truncate">
                File: {file.name}
              </p>
            </div>

            {/* Compressed Card */}
            <div className="space-y-2 border-2 border-[#5ADBE5]/60 rounded-2xl p-3.5 bg-cyan-50/20">
              <div className="flex items-center justify-between text-xs">
                <span className="font-extrabold text-[#0A82A8] flex items-center space-x-1">
                  <span>Optimized WebP</span>
                  <span className="text-[10px] bg-emerald-500 text-white px-1.5 py-0.2 rounded font-black">
                    FAST
                  </span>
                </span>
                <span className="text-emerald-700 font-extrabold">{result.formattedCompressedSize}</span>
              </div>
              <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-200 border border-slate-200 flex items-center justify-center">
                {previewCompressedUrl && (
                  <img
                    src={previewCompressedUrl}
                    alt="Compressed WebP preview"
                    className="w-full h-full object-contain"
                  />
                )}
              </div>
              <p className="text-[10px] text-slate-500 truncate">
                Ready for high-speed mobile delivery: {result.file.name}
              </p>
            </div>
          </div>

          {/* Actions Bar */}
          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleDownload}
                className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-2xl text-xs font-bold text-white shadow-xs hover:opacity-95 active:scale-95 transition cursor-pointer"
                style={{ background: "linear-gradient(to bottom, #5ADBE5, #0A82A8)" }}
              >
                <Download className="w-4 h-4" />
                <span>Download Optimized File</span>
              </button>

              <button
                type="button"
                onClick={handleUploadToStorage}
                disabled={uploadingToStorage}
                className="inline-flex items-center space-x-1.5 px-4 py-2.5 rounded-2xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 transition active:scale-95 cursor-pointer disabled:opacity-50"
              >
                {uploadingToStorage ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Uploading to Supabase...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5 text-[#0A82A8]" />
                    <span>Upload to Cloud Storage</span>
                  </>
                )}
              </button>
            </div>

            {uploadedUrl && (
              <div className="flex items-center space-x-2 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-2xl animate-in zoom-in-95">
                <a
                  href={uploadedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-emerald-800 font-bold hover:underline flex items-center space-x-1"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>View Live URL</span>
                </a>

                <button
                  type="button"
                  onClick={handleCopyUrl}
                  className="px-2.5 py-1 rounded-xl bg-white border border-emerald-300 text-emerald-700 text-xs font-bold hover:bg-emerald-50 transition cursor-pointer flex items-center space-x-1"
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy URL</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
