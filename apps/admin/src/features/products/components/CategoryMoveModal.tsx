import { useState } from "react";
import {
  X,
  Folder,
  Layers,
  HelpCircle,
  Search,
  Check,
  Loader2,
  ArrowRight,
} from "lucide-react";
import type { CategoryNode } from "@urbanrat/shared";
import { triggerHaptic } from "../../../utils/haptics";

interface CategoryMoveModalProps {
  isOpen: boolean;
  onClose: () => void;
  categoryTree: CategoryNode[];
  selectedProductCount: number;
  onConfirmMove: (targetCategoryId: string | null) => Promise<void>;
}

export function CategoryMoveModal({
  isOpen,
  onClose,
  categoryTree,
  selectedProductCount,
  onConfirmMove,
}: CategoryMoveModalProps) {
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [isUncategorizedTarget, setIsUncategorizedTarget] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  // Flatten nodes for quick search
  function flattenNodes(nodes: CategoryNode[]): CategoryNode[] {
    const list: CategoryNode[] = [];
    for (const node of nodes) {
      list.push(node);
      if (node.children && node.children.length > 0) {
        list.push(...flattenNodes(node.children));
      }
    }
    return list;
  }

  const allCategories = flattenNodes(categoryTree);
  const filteredCategories = searchQuery.trim()
    ? allCategories.filter(
        (c) =>
          c.name.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
          c.fullPath?.toLowerCase().includes(searchQuery.trim().toLowerCase())
      )
    : allCategories;

  const selectedCategoryNode = allCategories.find((c) => c.id === selectedTargetId);
  const targetPath = isUncategorizedTarget
    ? "Uncategorized (No category)"
    : selectedCategoryNode?.fullPath || selectedCategoryNode?.name || "";

  async function handleConfirm() {
    if (!isUncategorizedTarget && !selectedTargetId) {
      alert("Please select a target category.");
      return;
    }
    setSaving(true);
    triggerHaptic("selection");
    try {
      await onConfirmMove(isUncategorizedTarget ? null : selectedTargetId);
      triggerHaptic("success");
      onClose();
    } catch (err: any) {
      alert(err?.message || "Failed to move products.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand-light/20 flex items-center justify-center text-brand-dark">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">
                Move {selectedProductCount} Products
              </h3>
              <p className="text-[11px] text-slate-400">
                Select target category in the store catalog
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Selected target preview */}
        <div className="p-3.5 bg-slate-50 border-b border-slate-100 text-xs">
          <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
            Destination Category:
          </span>
          <div className="flex items-center space-x-2 font-bold text-slate-800">
            <ArrowRight className="w-3.5 h-3.5 text-brand-dark shrink-0" />
            <span className={targetPath ? "text-brand-dark" : "text-slate-400 italic"}>
              {targetPath || "None selected yet"}
            </span>
          </div>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-slate-100 bg-white">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search target category..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand-light/50 bg-slate-50"
            />
          </div>
        </div>

        {/* Category List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-1.5 max-h-72">
          {/* Uncategorized Option */}
          <div
            onClick={() => {
              triggerHaptic("selection");
              setIsUncategorizedTarget(true);
              setSelectedTargetId(null);
            }}
            className={`p-2.5 rounded-2xl border flex items-center justify-between transition cursor-pointer ${
              isUncategorizedTarget
                ? "bg-amber-50 border-amber-500 text-amber-900 ring-1 ring-amber-400/40"
                : "bg-white hover:bg-slate-50 border-slate-200 text-slate-700"
            }`}
          >
            <div className="flex items-center space-x-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <HelpCircle className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="font-bold text-xs truncate block">Uncategorized</span>
                <span className="text-[10px] text-slate-400 block">Remove from existing category</span>
              </div>
            </div>
            {isUncategorizedTarget && <Check className="w-4 h-4 text-amber-700" />}
          </div>

          <div className="pt-1 border-t border-slate-100 my-1" />

          {/* Filtered Categories */}
          {filteredCategories.map((cat) => {
            const isSelected = selectedTargetId === cat.id && !isUncategorizedTarget;

            return (
              <div
                key={cat.id}
                onClick={() => {
                  triggerHaptic("selection");
                  setSelectedTargetId(cat.id);
                  setIsUncategorizedTarget(false);
                }}
                className={`p-2.5 rounded-2xl border flex items-center justify-between transition cursor-pointer ${
                  isSelected
                    ? "bg-brand-light/15 border-brand-dark text-slate-900 ring-1 ring-brand-dark/25"
                    : "bg-white hover:bg-slate-50 border-slate-200/80 text-slate-700"
                }`}
              >
                <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                  <div className="w-7 h-7 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
                    <Folder className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="font-bold text-xs truncate block text-slate-800">
                      {cat.name}
                    </span>
                    {cat.fullPath && cat.fullPath !== cat.name && (
                      <span className="text-[10px] text-slate-400 truncate block">
                        {cat.fullPath}
                      </span>
                    )}
                  </div>
                </div>

                {isSelected && <Check className="w-4 h-4 text-brand-dark shrink-0 ml-2" />}
              </div>
            );
          })}
        </div>

        {/* Modal Actions */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end space-x-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-100 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || (!isUncategorizedTarget && !selectedTargetId)}
            onClick={handleConfirm}
            className="px-5 py-2 rounded-xl brand-gradient text-white text-xs font-bold shadow-md hover:shadow-lg transition active:scale-95 cursor-pointer disabled:opacity-50 flex items-center space-x-1.5"
          >
            {saving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Moving...</span>
              </>
            ) : (
              <span>Move {selectedProductCount} Products</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
