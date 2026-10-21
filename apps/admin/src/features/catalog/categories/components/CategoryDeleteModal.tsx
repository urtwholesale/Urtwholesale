import { useState, useEffect } from "react";
import { X, Trash2, AlertTriangle, AlertCircle, Loader2 } from "lucide-react";
import type { Category } from "@urbanrat/shared";
import { triggerHaptic } from "../../../../utils/haptics";
import { checkCategoryDeletion, deleteCategory, type CategoryDeletionCheck } from "../../../../lib/adminService";

interface CategoryDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeleted: (categoryId: string) => void;
  category: Category | null;
}

export function CategoryDeleteModal({
  isOpen,
  onClose,
  onDeleted,
  category,
}: CategoryDeleteModalProps) {
  const [isChecking, setIsChecking] = useState(true);
  const [checkResult, setCheckResult] = useState<CategoryDeletionCheck | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && category) {
      setIsChecking(true);
      setErrorMessage(null);
      checkCategoryDeletion(category.id)
        .then((res) => {
          setCheckResult(res);
        })
        .catch((err) => {
          setErrorMessage(err.message || "Failed to inspect category dependencies.");
        })
        .finally(() => {
          setIsChecking(false);
        });
    } else {
      setCheckResult(null);
      setErrorMessage(null);
    }
  }, [isOpen, category]);

  if (!isOpen || !category) return null;

  async function handleDelete() {
    if (!checkResult?.canDelete) return;

    try {
      setIsDeleting(true);
      setErrorMessage(null);
      await deleteCategory(category!.id);
      triggerHaptic("success");
      onDeleted(category!.id);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to delete category.");
      triggerHaptic("heavy");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
              <Trash2 className="w-4 h-4 stroke-2" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900">Delete Category</h2>
              <p className="text-[11px] text-slate-400 font-medium truncate max-w-[220px]">
                {category.name}
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

        {/* Content */}
        <div className="p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {isChecking ? (
            <div className="py-8 flex flex-col items-center justify-center space-y-2 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-brand-dark" />
              <p className="text-xs font-semibold">Checking child categories & product links...</p>
            </div>
          ) : checkResult && !checkResult.canDelete ? (
            // Deletion Blocked Banner
            <div className="space-y-3">
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-900 space-y-2">
                <div className="flex items-center space-x-2 text-xs font-bold text-amber-950">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Deletion Blocked</span>
                </div>
                <p className="text-xs leading-relaxed text-amber-900 font-medium">
                  {checkResult.reason}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                  <span className="text-xs font-black text-slate-900 block">
                    {checkResult.childrenCount}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">Subcategories</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                  <span className="text-xs font-black text-slate-900 block">
                    {checkResult.productCount}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">Assigned Products</span>
                </div>
              </div>

              <p className="text-[11px] text-slate-500 text-center">
                To delete this category, please delete or reassign its subcategories and move products to another category first.
              </p>
            </div>
          ) : (
            // Clean deletion confirmation
            <div className="space-y-2">
              <p className="text-xs text-slate-700 leading-relaxed">
                Are you sure you want to permanently delete{" "}
                <strong className="text-slate-900">{category.name}</strong>?
              </p>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                This category has no nested subcategories and no products assigned. This action cannot be undone.
              </p>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-3 flex items-center justify-end space-x-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleDelete}
              disabled={isChecking || isDeleting || !checkResult?.canDelete}
              className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-xs flex items-center space-x-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Confirm Delete</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
