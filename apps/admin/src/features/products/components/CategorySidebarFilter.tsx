import React, { useState } from "react";
import {
  Folder,
  Layers,
  ChevronRight,
  ChevronDown,
  Search,
  Check,
  Package,
  HelpCircle,
  SlidersHorizontal,
} from "lucide-react";
import type { CategoryNode, CategoryProductCounts } from "@urbanrat/shared";
import { triggerHaptic } from "../../../utils/haptics";

interface CategorySidebarFilterProps {
  categoryTree: CategoryNode[];
  countsMap: Record<string, CategoryProductCounts>;
  uncategorizedCounts: CategoryProductCounts;
  totalProductsCount: number;
  selectedCategoryId: string | null;
  uncategorizedOnly: boolean;
  includeDescendants: boolean;
  isLoading?: boolean;
  onSelectCategory: (categoryId: string | null, isUncategorized?: boolean) => void;
  onToggleIncludeDescendants: (include: boolean) => void;
}

export function CategorySidebarFilter({
  categoryTree,
  uncategorizedCounts,
  totalProductsCount,
  selectedCategoryId,
  uncategorizedOnly,
  includeDescendants,
  isLoading = false,
  onSelectCategory,
  onToggleIncludeDescendants,
}: CategorySidebarFilterProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [brokenImageIds, setBrokenImageIds] = useState<Set<string>>(new Set());

  // Auto-expand path to currently selected category
  React.useEffect(() => {
    if (selectedCategoryId) {
      setExpandedIds((prev) => {
        const next = new Set(prev);
        function findAndExpand(nodes: CategoryNode[]): boolean {
          for (const node of nodes) {
            if (node.id === selectedCategoryId) {
              return true;
            }
            if (node.children && node.children.length > 0) {
              if (findAndExpand(node.children)) {
                next.add(node.id);
                return true;
              }
            }
          }
          return false;
        }
        findAndExpand(categoryTree);
        return next;
      });
    }
  }, [selectedCategoryId, categoryTree]);

  function handleToggleExpand(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    triggerHaptic("selection");
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleImageError(id: string) {
    setBrokenImageIds((prev) => new Set(prev).add(id));
  }

  // Filter tree when search query is typed
  const isSearching = searchQuery.trim().length > 0;
  const normalizedQuery = searchQuery.trim().toLowerCase();

  function filterNodes(nodes: CategoryNode[]): CategoryNode[] {
    const results: CategoryNode[] = [];
    for (const node of nodes) {
      const matchesSelf = node.name.toLowerCase().includes(normalizedQuery);
      const filteredChildren = filterNodes(node.children || []);
      if (matchesSelf || filteredChildren.length > 0) {
        results.push({
          ...node,
          children: filteredChildren,
        });
      }
    }
    return results;
  }

  const displayedNodes = isSearching ? filterNodes(categoryTree) : categoryTree;

  // Render a category card recursively
  function renderCategoryCard(node: CategoryNode, depth: number = 1) {
    const isSelected = selectedCategoryId === node.id && !uncategorizedOnly;
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = isSearching || expandedIds.has(node.id);
    const isImageBroken = brokenImageIds.has(node.id);
    const count = node.total_count ?? 0;
    const isCountZero = count === 0;

    return (
      <div key={node.id} className="space-y-1">
        <div
          onClick={() => {
            triggerHaptic("selection");
            onSelectCategory(node.id, false);
          }}
          className={`group relative rounded-2xl p-2.5 transition-all cursor-pointer border flex items-center justify-between gap-2 select-none ${
            isSelected
              ? "bg-linear-to-r from-sky-50 via-teal-50/70 to-white text-slate-900 border-brand-dark/40 ring-1 ring-brand-dark/25 shadow-xs"
              : "bg-white hover:bg-slate-50/90 text-slate-800 border-slate-200/80 hover:border-slate-300 shadow-2xs"
          } ${depth > 1 ? "ml-3" : ""}`}
        >
          {/* Left: Thumbnail & Name */}
          <div className="flex items-center space-x-2.5 min-w-0 flex-1">
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 overflow-hidden border transition-colors ${
                isSelected
                  ? "bg-white border-brand-dark/30 shadow-2xs ring-1 ring-brand-dark/20"
                  : "bg-slate-50 border-slate-200/80"
              }`}
            >
              {node.image_url && !isImageBroken ? (
                <img
                  src={node.image_url}
                  alt=""
                  onError={() => handleImageError(node.id)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Folder
                  className={`w-3.5 h-3.5 ${
                    isSelected ? "text-brand-dark" : "text-slate-400"
                  }`}
                />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <span
                className={`text-xs truncate block ${
                  isSelected ? "font-extrabold text-slate-900" : "font-bold text-slate-800"
                }`}
                title={node.name}
              >
                {node.name}
              </span>
              <span
                className={`text-[10px] truncate block ${
                  isSelected ? "font-medium text-brand-dark/90" : "font-medium text-slate-400"
                }`}
              >
                /{node.slug}
              </span>
            </div>
          </div>

          {/* Right: Count Badge & Expand Toggle */}
          <div className="flex items-center space-x-1.5 shrink-0">
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border transition ${
                isCountZero
                  ? "bg-slate-100 text-slate-400 border-slate-200"
                  : isSelected
                  ? "bg-brand-dark text-white border-brand-dark shadow-2xs"
                  : "bg-slate-50 text-slate-700 border-slate-200"
              }`}
              title={`${count} total products in this branch`}
            >
              {count}
            </span>

            {hasChildren && (
              <button
                type="button"
                onClick={(e) => handleToggleExpand(e, node.id)}
                className="w-6 h-6 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition"
                title={isExpanded ? "Collapse subcategories" : "Expand subcategories"}
              >
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </button>
            )}

            {isSelected && !hasChildren && (
              <div className="w-4 h-4 rounded-full bg-brand-dark flex items-center justify-center text-white shrink-0">
                <ChevronRight className="w-3 h-3 stroke-3" />
              </div>
            )}
          </div>
        </div>

        {/* Children (if expanded) */}
        {hasChildren && isExpanded && (
          <div className="space-y-1 pl-1 border-l-2 border-slate-100 ml-3">
            {node.children.map((child) => renderCategoryCard(child, depth + 1))}
          </div>
        )}
      </div>
    );
  }

  const isAllSelected = selectedCategoryId === null && !uncategorizedOnly;

  return (
    <aside className="w-full lg:w-80 shrink-0 space-y-3.5">
      {/* Side Panel Container */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xs p-4 flex flex-col space-y-3.5 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] overflow-hidden">
        {/* Panel Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-xl bg-brand-light/20 flex items-center justify-center text-brand-dark">
              <Layers className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-black text-slate-900 tracking-tight">Categories</h3>
          </div>
          <span className="text-[11px] font-bold text-slate-400">
            {categoryTree.length} root
          </span>
        </div>

        {/* Search Categories */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search categories..."
            className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand-light/50 bg-slate-50/50"
          />
        </div>

        {/* Subcategories toggle */}
        <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
            <span className="font-bold text-slate-700 text-[11px]">Include subcategories</span>
          </div>
          <button
            type="button"
            onClick={() => {
              triggerHaptic("selection");
              onToggleIncludeDescendants(!includeDescendants);
            }}
            className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 cursor-pointer ${
              includeDescendants ? "bg-brand-dark" : "bg-slate-300"
            }`}
            title="Toggle recursive descendant products"
          >
            <div
              className={`w-4 h-4 rounded-full bg-white shadow-xs transition-transform duration-200 ${
                includeDescendants ? "translate-x-4" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* Scrollable Category List */}
        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 max-h-[55vh] custom-scrollbar">
          {isLoading ? (
            <div className="space-y-2 py-1 animate-pulse">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-11 rounded-2xl bg-slate-100 border border-slate-200/50" />
              ))}
            </div>
          ) : (
            <>
              {/* "All Products" Card */}
              <div
                onClick={() => {
                  triggerHaptic("selection");
                  onSelectCategory(null, false);
                }}
                className={`group rounded-2xl p-2.5 transition-all cursor-pointer border flex items-center justify-between gap-2 ${
                  isAllSelected
                    ? "bg-linear-to-r from-sky-50 via-teal-50/70 to-white text-slate-900 border-brand-dark/40 ring-1 ring-brand-dark/25 shadow-xs"
                : "bg-white hover:bg-slate-50/90 text-slate-800 border-slate-200/80 hover:border-slate-300 shadow-2xs"
            }`}
          >
            <div className="flex items-center space-x-2.5 min-w-0">
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
                  isAllSelected
                    ? "bg-white border-brand-dark/30 shadow-2xs text-brand-dark"
                    : "bg-slate-50 border-slate-200/80 text-slate-400"
                }`}
              >
                <Package className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className={`text-xs truncate block ${isAllSelected ? "font-extrabold" : "font-bold"}`}>
                  All Products
                </span>
                <span className="text-[10px] text-slate-400 block">Whole store catalog</span>
              </div>
            </div>

            <div className="flex items-center space-x-1.5">
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${
                  isAllSelected
                    ? "bg-brand-dark text-white border-brand-dark shadow-2xs"
                    : "bg-slate-50 text-slate-700 border-slate-200"
                }`}
              >
                {totalProductsCount}
              </span>
              {isAllSelected && (
                <div className="w-4 h-4 rounded-full bg-brand-dark flex items-center justify-center text-white shrink-0">
                  <Check className="w-2.5 h-2.5 stroke-3" />
                </div>
              )}
            </div>
          </div>

          {/* "Uncategorized" Card */}
          <div
            onClick={() => {
              triggerHaptic("selection");
              onSelectCategory(null, true);
            }}
            className={`group rounded-2xl p-2.5 transition-all cursor-pointer border flex items-center justify-between gap-2 ${
              uncategorizedOnly
                ? "bg-linear-to-r from-amber-50 via-amber-50/50 to-white text-slate-900 border-amber-500/40 ring-1 ring-amber-500/25 shadow-xs"
                : "bg-white hover:bg-slate-50/90 text-slate-800 border-slate-200/80 hover:border-slate-300 shadow-2xs"
            }`}
          >
            <div className="flex items-center space-x-2.5 min-w-0">
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
                  uncategorizedOnly
                    ? "bg-white border-amber-500/30 shadow-2xs text-amber-600"
                    : "bg-slate-50 border-slate-200/80 text-slate-400"
                }`}
              >
                <HelpCircle className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span
                  className={`text-xs truncate block ${
                    uncategorizedOnly ? "font-extrabold text-amber-950" : "font-bold text-slate-800"
                  }`}
                >
                  Uncategorized
                </span>
                <span className="text-[10px] text-slate-400 block">Needs assignment</span>
              </div>
            </div>

            <div className="flex items-center space-x-1.5">
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${
                  (uncategorizedCounts.total_count ?? 0) === 0
                    ? "bg-slate-100 text-slate-400 border-slate-200"
                    : uncategorizedOnly
                    ? "bg-amber-600 text-white border-amber-600 shadow-2xs"
                    : "bg-amber-50 text-amber-800 border-amber-200"
                }`}
              >
                {uncategorizedCounts.total_count ?? 0}
              </span>
              {uncategorizedOnly && (
                <div className="w-4 h-4 rounded-full bg-amber-600 flex items-center justify-center text-white shrink-0">
                  <Check className="w-2.5 h-2.5 stroke-3" />
                </div>
              )}
            </div>
          </div>

          <div className="pt-1 border-t border-slate-100 my-1" />

              {/* Category Tree Root Nodes */}
              {displayedNodes.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400">
                  No categories match &quot;{searchQuery}&quot;
                </div>
              ) : (
                displayedNodes.map((node) => renderCategoryCard(node, 1))
              )}
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
