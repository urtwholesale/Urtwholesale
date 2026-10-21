import { useState, useMemo } from "react";
import type { Category } from "@urbanrat/shared";
import {
  X,
  Plus,
  FolderTree,
  Upload,
  Check,
  AlertCircle,
  ChevronRight,
  ImageIcon,
  Loader2,
  Edit2,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { uploadProductImage } from "../../lib/adminService";
import { triggerHaptic } from "../../utils/haptics";
import { buildCategoryTree, getCategoryDepth } from "./utils/categoryTree";
import type { CategoryNode } from "./types";

interface CategoryManagerModalProps {
  categories: Category[];
  isOpen: boolean;
  onClose: () => void;
  onCategoriesUpdated: () => void;
}

export function CategoryManagerModal({
  categories,
  isOpen,
  onClose,
  onCategoriesUpdated,
}: CategoryManagerModalProps) {
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Form states
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [parentId, setParentId] = useState<string | "">("");
  const [imageUrl, setImageUrl] = useState<string>("");
  const [sortOrder, setSortOrder] = useState<number>(0);
  const [isActive, setIsActive] = useState<boolean>(true);

  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Build tree for hierarchical rendering
  const tree = useMemo(() => buildCategoryTree(categories), [categories]);

  // Valid parent options: Only categories at depth 1, 2, or 3 (so children don't exceed depth 4)
  const eligibleParents = useMemo(() => {
    return categories
      .filter((c) => {
        // Exclude current editing category to prevent self-parenting loops
        if (editingCategory && c.id === editingCategory.id) return false;
        const depth = getCategoryDepth(c.id, categories);
        return depth >= 1 && depth <= 3;
      })
      .map((c) => ({
        id: c.id,
        name: c.name,
        depth: getCategoryDepth(c.id, categories),
      }))
      .sort((a, b) => a.depth - b.depth || a.name.localeCompare(b.name));
  }, [categories, editingCategory]);

  if (!isOpen) return null;

  function resetForm() {
    setEditingCategory(null);
    setIsCreating(false);
    setName("");
    setSlug("");
    setParentId("");
    setImageUrl("");
    setSortOrder(0);
    setIsActive(true);
    setError(null);
  }

  function handleStartCreate(parentCategoryId?: string) {
    triggerHaptic("selection");
    resetForm();
    setIsCreating(true);
    if (parentCategoryId) {
      setParentId(parentCategoryId);
    }
  }

  function handleStartEdit(cat: Category) {
    triggerHaptic("selection");
    setEditingCategory(cat);
    setIsCreating(false);
    setName(cat.name);
    setSlug(cat.slug);
    setParentId(cat.parent_id || "");
    setImageUrl(cat.image_url || "");
    setSortOrder(cat.sort_order || 0);
    setIsActive(cat.is_active ?? true);
    setError(null);
  }

  function handleNameChange(val: string) {
    setName(val);
    if (isCreating) {
      const generatedSlug = val
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      setSlug(generatedSlug);
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    setError(null);
    try {
      const url = await uploadProductImage(file);
      setImageUrl(url);
      triggerHaptic("success");
    } catch (err: any) {
      setError(err.message || "Failed to upload category image");
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleSaveCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Category name is required.");
      return;
    }
    if (!slug.trim()) {
      setError("Category slug is required.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = {
        name: name.trim(),
        slug: slug.trim().toLowerCase(),
        parent_id: parentId ? parentId : null,
        image_url: imageUrl.trim() || null,
        sort_order: sortOrder || 0,
        is_active: isActive,
      };

      if (editingCategory) {
        const { error: updateErr } = await supabase
          .from("categories")
          .update(payload)
          .eq("id", editingCategory.id);
        if (updateErr) throw updateErr;
        setSuccessMsg(`Category "${name}" updated successfully.`);
      } else {
        const { error: insertErr } = await supabase
          .from("categories")
          .insert(payload);
        if (insertErr) throw insertErr;
        setSuccessMsg(`Category "${name}" created successfully.`);
      }

      triggerHaptic("success");
      onCategoriesUpdated();
      setTimeout(() => {
        resetForm();
        setSuccessMsg(null);
      }, 1200);
    } catch (err: any) {
      setError(err.message || "Failed to save category");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-dark text-white flex items-center justify-center shadow-2xs">
              <FolderTree className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                Multi-Level Category Hierarchy
              </h3>
              <p className="text-xs text-slate-400">
                Configure up to 4 levels (L1 Main → L2 Sub → L3 Group → L4 Item)
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {!isCreating && !editingCategory && (
              <button
                type="button"
                onClick={() => handleStartCreate()}
                className="px-3 py-1.5 rounded-xl brand-gradient text-white text-xs font-bold flex items-center space-x-1.5 shadow-2xs cursor-pointer hover:opacity-95"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Category</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 md:grid-cols-12 gap-5">
          {/* Left Column: Category Tree View */}
          <div className="md:col-span-6 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Current Taxonomy ({categories.length})
              </span>
              <span className="text-[11px] text-slate-400">Max Depth: 4 Levels</span>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 max-h-[460px] overflow-y-auto space-y-1">
              {tree.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  No categories found. Click "New Category" to create your first root department.
                </div>
              ) : (
                tree.map((l1) => (
                  <CategoryTreeNodeView
                    key={l1.id}
                    node={l1}
                    onEdit={handleStartEdit}
                    onAddChild={handleStartCreate}
                  />
                ))
              )}
            </div>
          </div>

          {/* Right Column: Create / Edit Form */}
          <div className="md:col-span-6 bg-slate-50/50 border border-slate-200/80 rounded-2xl p-4 flex flex-col">
            {isCreating || editingCategory ? (
              <form onSubmit={handleSaveCategory} className="space-y-3.5">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    {editingCategory ? `Edit: ${editingCategory.name}` : "Create New Category"}
                  </h4>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="text-[11px] text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>

                {error && (
                  <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {successMsg && (
                  <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center space-x-2">
                    <Check className="w-4 h-4 shrink-0" />
                    <span>{successMsg}</span>
                  </div>
                )}

                {/* Parent Category Selector */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Parent Category (Hierarchy Level)
                  </label>
                  <select
                    value={parentId}
                    onChange={(e) => setParentId(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-light focus:border-brand shadow-2xs"
                  >
                    <option value="">[None — Root Department (Level 1)]</option>
                    {eligibleParents.map((p) => (
                      <option key={p.id} value={p.id}>
                        {"— ".repeat(p.depth - 1)}Level {p.depth}: {p.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Level 4 is the maximum depth allowed. Categories at level 4 cannot have children.
                  </p>
                </div>

                {/* Name */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Category Name*
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="e.g. Type-C Fast Chargers"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-light focus:border-brand shadow-2xs"
                    required
                  />
                </div>

                {/* Slug */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    URL Slug*
                  </label>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="e.g. type-c-fast-chargers"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-brand-light focus:border-brand shadow-2xs"
                    required
                  />
                </div>

                {/* Category Image */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Category Thumbnail Image
                  </label>
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 overflow-hidden flex items-center justify-center shrink-0 shadow-2xs">
                      {imageUrl ? (
                        <img src={imageUrl} alt="Thumbnail" className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon className="w-5 h-5 text-slate-300" />
                      )}
                    </div>
                    <label className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center space-x-1.5 cursor-pointer shadow-2xs">
                      {uploadingImage ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Upload className="w-3.5 h-3.5" />
                      )}
                      <span>{uploadingImage ? "Optimizing..." : "Upload Image"}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                    </label>
                    {imageUrl && (
                      <button
                        type="button"
                        onClick={() => setImageUrl("")}
                        className="text-[10px] text-rose-500 hover:underline cursor-pointer"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>

                {/* Sort Order & Active */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Sort Order
                    </label>
                    <input
                      type="number"
                      value={sortOrder}
                      onChange={(e) => setSortOrder(parseInt(e.target.value, 10) || 0)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-light focus:border-brand shadow-2xs"
                    />
                  </div>
                  <div className="flex items-end pb-2">
                    <label className="flex items-center space-x-2 text-xs font-bold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isActive}
                        onChange={(e) => setIsActive(e.target.checked)}
                        className="w-4 h-4 text-brand-dark rounded border-slate-300 focus:ring-brand-light"
                      />
                      <span>Active in Store</span>
                    </label>
                  </div>
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full py-2.5 rounded-xl brand-gradient text-white text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center space-x-2 cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{editingCategory ? "Update Category" : "Save Category"}</span>
                </button>
              </form>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-300 shadow-2xs">
                  <FolderTree className="w-6 h-6" />
                </div>
                <div>
                  <h5 className="text-xs font-bold text-slate-700">Category Details</h5>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
                    Select any category from the left tree to view/edit, or click "+ New Category" to expand your catalog structure.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleStartCreate()}
                  className="px-4 py-2 rounded-xl brand-gradient text-white text-xs font-bold shadow-2xs cursor-pointer hover:opacity-95"
                >
                  + Add Category
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Recursive tree node renderer
function CategoryTreeNodeView({
  node,
  onEdit,
  onAddChild,
}: {
  node: CategoryNode;
  onEdit: (cat: Category) => void;
  onAddChild: (parentId: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;
  const canHaveChildren = node.level < 4;

  const levelBadgeColors: Record<number, string> = {
    1: "bg-blue-50 text-blue-700 border-blue-200",
    2: "bg-teal-50 text-teal-700 border-teal-200",
    3: "bg-amber-50 text-amber-700 border-amber-200",
    4: "bg-purple-50 text-purple-700 border-purple-200",
  };

  return (
    <div className="space-y-1">
      <div
        className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-100 hover:border-slate-200 transition shadow-2xs group"
        style={{ marginLeft: `${(node.level - 1) * 14}px` }}
      >
        <div className="flex items-center space-x-2 min-w-0">
          {hasChildren ? (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="w-4 h-4 text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer shrink-0"
            >
              <ChevronRight
                className={`w-3.5 h-3.5 transition-transform ${expanded ? "rotate-90" : ""}`}
              />
            </button>
          ) : (
            <span className="w-4 shrink-0" />
          )}

          <span
            className={`text-[9px] font-black uppercase px-1.5 py-0.2 rounded border ${
              levelBadgeColors[node.level] || "bg-slate-100 text-slate-600 border-slate-200"
            }`}
          >
            L{node.level}
          </span>

          <span className="text-xs font-bold text-slate-800 truncate">{node.name}</span>
          {!node.is_active && (
            <span className="text-[9px] text-slate-400 font-medium italic">(Hidden)</span>
          )}
        </div>

        <div className="flex items-center space-x-1 opacity-80 group-hover:opacity-100 shrink-0">
          {canHaveChildren && (
            <button
              type="button"
              onClick={() => onAddChild(node.id)}
              title="Add child category under this"
              className="p-1 rounded-lg text-slate-400 hover:text-brand-dark hover:bg-slate-100 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => onEdit(node)}
            title="Edit category"
            className="p-1 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {hasChildren && expanded && (
        <div className="space-y-1">
          {node.children.map((child) => (
            <CategoryTreeNodeView
              key={child.id}
              node={child}
              onEdit={onEdit}
              onAddChild={onAddChild}
            />
          ))}
        </div>
      )}
    </div>
  );
}
