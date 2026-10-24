import { useState, useMemo } from "react";
import {
  X,
  ChevronRight,
  ArrowLeft,
  Folder,
  Layers,
  Package,
  HelpCircle,
  Search,
  Check,
  CheckCircle2,
} from "lucide-react";
import type { CategoryNode, CategoryProductCounts } from "@urbanrat/shared";
import { triggerHaptic } from "../../../utils/haptics";

interface CategoryMobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  categoryTree: CategoryNode[];
  countsMap: Record<string, CategoryProductCounts>;
  uncategorizedCounts: CategoryProductCounts;
  totalProductsCount: number;
  selectedCategoryId: string | null;
  uncategorizedOnly: boolean;
  onSelectCategory: (categoryId: string | null, isUncategorized?: boolean) => void;
}

export function CategoryMobileDrawer({
  isOpen,
  onClose,
  categoryTree,
  uncategorizedCounts,
  totalProductsCount,
  selectedCategoryId,
  uncategorizedOnly,
  onSelectCategory,
}: CategoryMobileDrawerProps) {
  // Navigation stack of parent CategoryNodes: [] means root level
  const [drillStack, setDrillStack] = useState<CategoryNode[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [brokenImageIds, setBrokenImageIds] = useState<Set<string>>(new Set());

  if (!isOpen) return null;

  const currentParent = drillStack[drillStack.length - 1] || null;
  const currentNodes = currentParent ? currentParent.children || [] : categoryTree;

  function handleImageError(id: string) {
    setBrokenImageIds((prev) => new Set(prev).add(id));
  }

  function handleDrillDown(node: CategoryNode) {
    triggerHaptic("selection");
    setDrillStack((prev) => [...prev, node]);
  }

  function handleDrillUp() {
    triggerHaptic("selection");
    setDrillStack((prev) => prev.slice(0, prev.length - 1));
  }

  function handleApplySelection(id: string | null, isUncat: boolean = false) {
    triggerHaptic("success");
    onSelectCategory(id, isUncat);
    onClose();
  }

  // Filtered nodes if searching
  const filteredNodes = useMemo(() => {
    if (!searchQuery.trim()) return currentNodes;
    const q = searchQuery.trim().toLowerCase();
    return currentNodes.filter((c) => c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q));
  }, [currentNodes, searchQuery]);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col justify-end animate-fade-in">
      <div className="bg-white rounded-t-3xl border-t border-slate-200 shadow-2xl max-h-[88vh] flex flex-col overflow-hidden pb-32">
        {/* Drawer Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 shrink-0">
          <div className="flex items-center space-x-2.5 min-w-0">
            {drillStack.length > 0 ? (
              <button
                type="button"
                onClick={handleDrillUp}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition cursor-pointer shrink-0"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            ) : (
              <div className="w-8 h-8 rounded-xl bg-brand-light/20 flex items-center justify-center text-brand-dark shrink-0">
                <Layers className="w-4 h-4" />
              </div>
            )}
            <div className="min-w-0">
              <h3 className="text-sm font-extrabold text-slate-900 truncate">
                {currentParent ? currentParent.name : "Browse Categories"}
              </h3>
              <p className="text-[11px] text-slate-400 truncate">
                {currentParent ? currentParent.fullPath : "Select category to filter catalog"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition cursor-pointer shrink-0 ml-2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-slate-100 shrink-0 bg-white">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search in this view..."
              className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand-light/50 bg-slate-50"
            />
          </div>
        </div>

        {/* Content List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {drillStack.length === 0 && !searchQuery.trim() && (
            <div className="grid grid-cols-2 gap-2 mb-3">
              {/* All Products */}
              <button
                type="button"
                onClick={() => handleApplySelection(null, false)}
                className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition cursor-pointer ${
                  selectedCategoryId === null && !uncategorizedOnly
                    ? "bg-brand-dark text-white border-brand-dark shadow-xs"
                    : "bg-slate-50 hover:bg-slate-100 border-slate-200/80 text-slate-800"
                }`}
              >
                <div className="flex items-center justify-between">
                  <Package className="w-4 h-4" />
                  <span className="text-[10px] font-black px-1.5 py-0.2 rounded-full bg-white/20">
                    {totalProductsCount}
                  </span>
                </div>
                <div className="mt-2 font-bold text-xs">All Products</div>
              </button>

              {/* Uncategorized */}
              <button
                type="button"
                onClick={() => handleApplySelection(null, true)}
                className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition cursor-pointer ${
                  uncategorizedOnly
                    ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                    : "bg-amber-50/60 hover:bg-amber-100/60 border-amber-200 text-amber-900"
                }`}
              >
                <div className="flex items-center justify-between">
                  <HelpCircle className="w-4 h-4" />
                  <span className="text-[10px] font-black px-1.5 py-0.2 rounded-full bg-white/40">
                    {uncategorizedCounts.total_count ?? 0}
                  </span>
                </div>
                <div className="mt-2 font-bold text-xs">Uncategorized</div>
              </button>
            </div>
          )}

          {/* Current Level Node Cards */}
          {filteredNodes.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No categories found.
            </div>
          ) : (
            filteredNodes.map((node) => {
              const isSelected = selectedCategoryId === node.id && !uncategorizedOnly;
              const hasChildren = node.children && node.children.length > 0;
              const isBroken = brokenImageIds.has(node.id);
              const count = node.total_count ?? 0;

              return (
                <div
                  key={node.id}
                  className={`p-3 rounded-2xl border flex items-center justify-between gap-3 transition cursor-pointer ${
                    isSelected
                      ? "bg-linear-to-r from-sky-50 via-teal-50 to-white border-brand-dark ring-1 ring-brand-dark/20 text-slate-900 shadow-xs"
                      : "bg-white hover:bg-slate-50 border-slate-200/80 text-slate-800"
                  }`}
                  onClick={() => {
                    if (hasChildren) {
                      handleDrillDown(node);
                    } else {
                      handleApplySelection(node.id, false);
                    }
                  }}
                >
                  <div className="flex items-center space-x-3 min-w-0 flex-1">
                    <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                      {node.image_url && !isBroken ? (
                        <img
                          src={node.image_url}
                          alt=""
                          onError={() => handleImageError(node.id)}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Folder className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-xs text-slate-900 truncate">
                        {node.name}
                      </p>
                      <p className="text-[10px] text-slate-400 truncate">
                        /{node.slug}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        count === 0
                          ? "bg-slate-100 text-slate-400 border-slate-200"
                          : isSelected
                          ? "bg-brand-dark text-white border-brand-dark"
                          : "bg-slate-50 text-slate-700 border-slate-200"
                      }`}
                    >
                      {count}
                    </span>

                    {hasChildren ? (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    ) : isSelected ? (
                      <Check className="w-4 h-4 text-brand-dark stroke-3" />
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* CTA: Show products for current drilled-in parent */}
        {currentParent && (
          <div className="p-3 border-t border-slate-100 bg-white shrink-0">
            <button
              type="button"
              onClick={() => handleApplySelection(currentParent.id, false)}
              className="w-full py-2.5 rounded-xl brand-gradient text-white text-xs font-bold shadow-md flex items-center justify-center space-x-1.5 transition active:scale-95 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Show products in &quot;{currentParent.name}&quot; ({currentParent.total_count})</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
