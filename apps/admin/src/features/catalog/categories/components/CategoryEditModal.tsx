import { useState, useEffect } from "react";
import { X, UploadCloud, Folder, Check, AlertCircle, Loader2, Image as ImageIcon } from "lucide-react";
import type { Category } from "@urbanrat/shared";
import { triggerHaptic } from "../../../../utils/haptics";
import {
  createCategory,
  updateCategory,
  uploadCategoryImage,
  slugifyCategoryName,
} from "../../../../lib/adminService";
import { getCategoryDepth } from "../../utils/categoryTree";

interface CategoryEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (category: Category) => void;
  categoryToEdit?: Category | null;
  defaultParentId?: string | null;
  allCategories: Category[];
}

export function CategoryEditModal({
  isOpen,
  onClose,
  onSaved,
  categoryToEdit,
  defaultParentId = null,
  allCategories,
}: CategoryEditModalProps) {
  const isEditing = Boolean(categoryToEdit);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [parentId, setParentId] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(true);

  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [uploadSavings, setUploadSavings] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (categoryToEdit) {
      setName(categoryToEdit.name);
      setSlug(categoryToEdit.slug);
      setParentId(categoryToEdit.parent_id);
      setImageUrl(categoryToEdit.image_url);
      setIsActive(categoryToEdit.is_active);
    } else {
      setName("");
      setSlug("");
      setParentId(defaultParentId);
      setImageUrl(null);
      setIsActive(true);
    }
    setUploadSavings(null);
    setErrorMessage(null);
  }, [categoryToEdit, defaultParentId, isOpen]);

  if (!isOpen) return null;

  // Compute allowed parents (max depth 3 so child is max depth 4, and exclude self/descendants if editing)
  const allowedParents = allCategories.filter((cat) => {
    if (isEditing && cat.id === categoryToEdit?.id) return false;
    const depth = getCategoryDepth(cat.id, allCategories);
    return depth < 4;
  });

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newName = e.target.value;
    setName(newName);
    if (!isEditing || !slug || slug === slugifyCategoryName(name)) {
      setSlug(slugifyCategoryName(newName));
    }
  }

  async function handleImageFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setErrorMessage("Please select a valid image file (PNG, JPG, WebP).");
      return;
    }

    try {
      setIsUploadingImage(true);
      setErrorMessage(null);
      const url = await uploadCategoryImage(file, (result) => {
        setUploadSavings(
          `Compressed to ${(result.compressedSize / 1024).toFixed(0)} KB (${result.savingsPercent}% saved)`
        );
      });
      setImageUrl(url);
      triggerHaptic("success");
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to upload image.");
      triggerHaptic("heavy");
    } finally {
      setIsUploadingImage(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage("Category name is required.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      let savedCategory: Category;
      if (isEditing && categoryToEdit) {
        savedCategory = await updateCategory(categoryToEdit.id, {
          name: name.trim(),
          slug: slug.trim() || slugifyCategoryName(name),
          parent_id: parentId,
          image_url: imageUrl,
          is_active: isActive,
        });
      } else {
        savedCategory = await createCategory({
          name: name.trim(),
          slug: slug.trim() || slugifyCategoryName(name),
          parent_id: parentId,
          image_url: imageUrl,
          is_active: isActive,
        });
      }

      triggerHaptic("success");
      onSaved(savedCategory);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to save category.");
      triggerHaptic("heavy");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-light/20 text-brand-dark flex items-center justify-center font-bold">
              <Folder className="w-4 h-4 stroke-2" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900">
                {isEditing ? "Edit Category" : "Create New Category"}
              </h2>
              <p className="text-[11px] text-slate-400 font-medium">
                {isEditing ? "Modify category details and placement" : "Add a category to your catalog tree"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          {errorMessage && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5">
              Category Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={handleNameChange}
              placeholder="e.g. Type-C Fast Chargers"
              required
              className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 focus:border-brand focus:ring-2 focus:ring-brand-light/30 text-xs font-medium text-slate-900 outline-none transition"
            />
          </div>

          {/* Slug */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5">
              URL Slug <span className="text-slate-400 font-normal">(auto-generated)</span>
            </label>
            <div className="flex items-center px-3.5 py-2 rounded-2xl border border-slate-200 bg-slate-50/50 text-xs">
              <span className="text-slate-400 select-none mr-1 font-mono">/</span>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="type-c-fast-chargers"
                className="w-full bg-transparent outline-none font-mono text-slate-800"
              />
            </div>
          </div>

          {/* Parent Category Picker */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5">
              Parent Category <span className="text-slate-400 font-normal">(Leave empty for Root / Level 1)</span>
            </label>
            <select
              value={parentId || ""}
              onChange={(e) => setParentId(e.target.value || null)}
              className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 focus:border-brand focus:ring-2 focus:ring-brand-light/30 text-xs font-medium text-slate-900 outline-none transition bg-white"
            >
              <option value="">None (Level 1 Root Category)</option>
              {allowedParents.map((parent) => {
                const depth = getCategoryDepth(parent.id, allCategories);
                return (
                  <option key={parent.id} value={parent.id}>
                    {"— ".repeat(depth - 1)} {parent.name} (Level {depth})
                  </option>
                );
              })}
            </select>
          </div>

          {/* Image Uploader */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5">
              Category Thumbnail <span className="text-slate-400 font-normal">(Optimized to WebP)</span>
            </label>

            <div className="flex items-center space-x-3">
              {/* Preview */}
              <div className="w-16 h-16 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-center shrink-0 overflow-hidden relative group">
                {imageUrl ? (
                  <>
                    <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setImageUrl(null)}
                      className="absolute inset-0 bg-black/60 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center text-[10px] font-bold transition cursor-pointer"
                    >
                      Remove
                    </button>
                  </>
                ) : (
                  <ImageIcon className="w-6 h-6 text-slate-300 stroke-1.5" />
                )}
              </div>

              {/* Upload Input */}
              <div className="flex-1">
                <label className="inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 cursor-pointer transition active:scale-95">
                  <UploadCloud className="w-4 h-4 text-brand-dark" />
                  <span>{isUploadingImage ? "Compressing & Uploading..." : "Choose Image"}</span>
                  <input
                    type="file"
                    accept="image/*"
                    disabled={isUploadingImage}
                    onChange={(e) => {
                      if (e.target.files?.[0]) handleImageFile(e.target.files[0]);
                    }}
                    className="hidden"
                  />
                </label>
                {uploadSavings && (
                  <p className="text-[10px] font-semibold text-emerald-600 mt-1">{uploadSavings}</p>
                )}
              </div>
            </div>
          </div>

          {/* Is Active Toggle */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-800">Active Status</p>
              <p className="text-[11px] text-slate-400">
                Inactive categories are hidden from the storefront catalog
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-dark" />
            </label>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isUploadingImage}
              className="px-5 py-2 rounded-xl bg-brand-dark hover:bg-brand-dark/90 text-white text-xs font-bold transition shadow-xs flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>{isEditing ? "Save Changes" : "Create Category"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
