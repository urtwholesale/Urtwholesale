import { useState, useMemo } from "react";
import type { Category } from "@urbanrat/shared";
import {
  Search,
  ChevronRight,
  FolderTree,
  CheckCircle2,
  Package,
  Layers,
  ArrowRight,
} from "lucide-react";
import { triggerHaptic } from "../../../utils/haptics";
import { getCategoryBreadcrumb } from "../utils/categoryTree";

interface CategoryCascaderProps {
  categories: Category[];
  selectedCategoryId: string | null;
  onSelectCategory: (category: Category, fullBreadcrumb: string) => void;
  actionButtonLabel?: string;
}

export function CategoryCascader({
  categories,
  selectedCategoryId,
  onSelectCategory,
  actionButtonLabel = "Continue with Selected Category",
}: CategoryCascaderProps) {
  const [searchQuery, setSearchQuery] = useState("");

  // Track selection at each level (level 1 to 4)
  const [level1Id, setLevel1Id] = useState<string | null>(null);
  const [level2Id, setLevel2Id] = useState<string | null>(null);
  const [level3Id, setLevel3Id] = useState<string | null>(null);
  const [level4Id, setLevel4Id] = useState<string | null>(null);

  // Group categories by parent_id
  const childrenMap = useMemo(() => {
    const map = new Map<string | null, Category[]>();
    categories.forEach((cat) => {
      const pid = cat.parent_id || null;
      if (!map.has(pid)) map.set(pid, []);
      map.get(pid)!.push(cat);
    });
    // Sort each group
    map.forEach((list) => {
      list.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || a.name.localeCompare(b.name));
    });
    return map;
  }, [categories]);

  const categoryById = useMemo(() => {
    return new Map<string, Category>(categories.map((c) => [c.id, c]));
  }, [categories]);

  // Level 1: Roots (parent_id is null)
  const level1Categories = useMemo(() => {
    return childrenMap.get(null) || [];
  }, [childrenMap]);

  // Level 2: Children of level 1
  const level2Categories = useMemo(() => {
    return level1Id ? childrenMap.get(level1Id) || [] : [];
  }, [childrenMap, level1Id]);

  // Level 3: Children of level 2
  const level3Categories = useMemo(() => {
    return level2Id ? childrenMap.get(level2Id) || [] : [];
  }, [childrenMap, level2Id]);

  // Level 4: Children of level 3
  const level4Categories = useMemo(() => {
    return level3Id ? childrenMap.get(level3Id) || [] : [];
  }, [childrenMap, level3Id]);

  // Current active leaf category
  const activeLeafCategory: Category | null = useMemo(() => {
    if (level4Id && categoryById.has(level4Id)) return categoryById.get(level4Id)!;
    if (level3Id && (childrenMap.get(level3Id)?.length || 0) === 0 && categoryById.has(level3Id)) {
      return categoryById.get(level3Id)!;
    }
    if (level2Id && (childrenMap.get(level2Id)?.length || 0) === 0 && categoryById.has(level2Id)) {
      return categoryById.get(level2Id)!;
    }
    if (level1Id && (childrenMap.get(level1Id)?.length || 0) === 0 && categoryById.has(level1Id)) {
      return categoryById.get(level1Id)!;
    }
    if (selectedCategoryId && categoryById.has(selectedCategoryId)) {
      return categoryById.get(selectedCategoryId)!;
    }
    return null;
  }, [level1Id, level2Id, level3Id, level4Id, selectedCategoryId, categoryById, childrenMap]);

  const activeBreadcrumb = useMemo(() => {
    if (!activeLeafCategory) return "";
    return getCategoryBreadcrumb(activeLeafCategory.id, categories);
  }, [activeLeafCategory, categories]);

  // Fast search suggestions across all levels
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return categories
      .filter((c) => c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q))
      .slice(0, 15)
      .map((c) => ({
        category: c,
        path: getCategoryBreadcrumb(c.id, categories),
      }));
  }, [searchQuery, categories]);

  function handleSelectFromSearch(cat: Category) {
    triggerHaptic("selection");
    setSearchQuery("");
    // Walk ancestors to set level ids
    const ancestors: Category[] = [];
    let curr: Category | undefined = cat;
    while (curr) {
      ancestors.unshift(curr);
      curr = curr.parent_id ? categoryById.get(curr.parent_id) : undefined;
    }

    setLevel1Id(ancestors[0]?.id || null);
    setLevel2Id(ancestors[1]?.id || null);
    setLevel3Id(ancestors[2]?.id || null);
    setLevel4Id(ancestors[3]?.id || null);
  }

  function handleSelectLevel1(id: string) {
    triggerHaptic("selection");
    setLevel1Id(id);
    setLevel2Id(null);
    setLevel3Id(null);
    setLevel4Id(null);
  }

  function handleSelectLevel2(id: string) {
    triggerHaptic("selection");
    setLevel2Id(id);
    setLevel3Id(null);
    setLevel4Id(null);
  }

  function handleSelectLevel3(id: string) {
    triggerHaptic("selection");
    setLevel3Id(id);
    setLevel4Id(null);
  }

  function handleSelectLevel4(id: string) {
    triggerHaptic("selection");
    setLevel4Id(id);
  }

  return (
    <div className="space-y-4">
      {/* ── Search Category Box ── */}
      <div className="relative">
        <div className="relative flex items-center">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search category (e.g., Chargers, Cables, Earphones, Trimmers)..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-light focus:border-brand shadow-2xs transition"
          />
        </div>

        {/* Search Results Dropdown */}
        {searchResults.length > 0 && (
          <div className="absolute z-30 left-0 right-0 mt-1.5 bg-white rounded-xl border border-slate-200 shadow-xl max-h-60 overflow-y-auto divide-y divide-slate-100">
            {searchResults.map((res) => (
              <button
                key={res.category.id}
                type="button"
                onClick={() => handleSelectFromSearch(res.category)}
                className="w-full px-3.5 py-2.5 text-left hover:bg-slate-50 flex items-center justify-between transition cursor-pointer"
              >
                <div>
                  <p className="text-xs font-bold text-slate-900">{res.category.name}</p>
                  <p className="text-[10px] text-slate-400">{res.path}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Multi-Column Cascader Container (1–4 Levels) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 bg-slate-50/80 p-3 rounded-2xl border border-slate-200/80 min-h-[320px]">
        {/* Column 1: Root Categories */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col h-[280px] sm:h-[320px] shadow-2xs">
          <div className="px-3 py-2 bg-slate-50/90 border-b border-slate-200 flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
              1. Main Department
            </span>
            <span className="text-[10px] text-slate-400 font-bold">{level1Categories.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-1 space-y-0.5">
            {level1Categories.map((cat) => {
              const isSelected = level1Id === cat.id;
              const hasKids = (childrenMap.get(cat.id)?.length || 0) > 0;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handleSelectLevel1(cat.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition text-left cursor-pointer ${
                    isSelected
                      ? "bg-brand-dark text-white shadow-2xs font-bold"
                      : "text-slate-700 hover:bg-slate-100/80 hover:text-slate-900"
                  }`}
                >
                  <span className="truncate pr-2">{cat.name}</span>
                  {hasKids ? (
                    <ChevronRight
                      className={`w-3.5 h-3.5 shrink-0 ${
                        isSelected ? "text-brand-light" : "text-slate-400"
                      }`}
                    />
                  ) : (
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                        isSelected ? "bg-white/20 text-white" : "text-slate-400"
                      }`}
                    >
                      Leaf
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Column 2: Level 2 Categories */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col h-[280px] sm:h-[320px] shadow-2xs">
          <div className="px-3 py-2 bg-slate-50/90 border-b border-slate-200 flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
              2. Subcategory
            </span>
            <span className="text-[10px] text-slate-400 font-bold">{level2Categories.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-1 space-y-0.5">
            {!level1Id ? (
              <div className="h-full flex flex-col items-center justify-center p-4 text-center text-slate-300">
                <Layers className="w-6 h-6 mb-1.5 opacity-50" />
                <span className="text-[11px]">Select a main category</span>
              </div>
            ) : level2Categories.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-4 text-center text-slate-400">
                <CheckCircle2 className="w-5 h-5 mb-1 text-emerald-500" />
                <span className="text-xs font-bold text-slate-700">Leaf Selected</span>
                <span className="text-[10px] text-slate-400">No further subcategories</span>
              </div>
            ) : (
              level2Categories.map((cat) => {
                const isSelected = level2Id === cat.id;
                const hasKids = (childrenMap.get(cat.id)?.length || 0) > 0;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleSelectLevel2(cat.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition text-left cursor-pointer ${
                      isSelected
                        ? "bg-brand-dark text-white shadow-2xs font-bold"
                        : "text-slate-700 hover:bg-slate-100/80 hover:text-slate-900"
                    }`}
                  >
                    <span className="truncate pr-2">{cat.name}</span>
                    {hasKids ? (
                      <ChevronRight
                        className={`w-3.5 h-3.5 shrink-0 ${
                          isSelected ? "text-brand-light" : "text-slate-400"
                        }`}
                      />
                    ) : (
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                          isSelected ? "bg-white/20 text-white" : "text-slate-400"
                        }`}
                      >
                        Leaf
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Column 3: Level 3 Categories */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col h-[280px] sm:h-[320px] shadow-2xs">
          <div className="px-3 py-2 bg-slate-50/90 border-b border-slate-200 flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
              3. Product Group
            </span>
            <span className="text-[10px] text-slate-400 font-bold">{level3Categories.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-1 space-y-0.5">
            {!level2Id ? (
              <div className="h-full flex flex-col items-center justify-center p-4 text-center text-slate-300">
                <FolderTree className="w-6 h-6 mb-1.5 opacity-50" />
                <span className="text-[11px]">Select subcategory</span>
              </div>
            ) : level3Categories.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-4 text-center text-slate-400">
                <CheckCircle2 className="w-5 h-5 mb-1 text-emerald-500" />
                <span className="text-xs font-bold text-slate-700">Terminal Category</span>
                <span className="text-[10px] text-slate-400">Products attach here</span>
              </div>
            ) : (
              level3Categories.map((cat) => {
                const isSelected = level3Id === cat.id;
                const hasKids = (childrenMap.get(cat.id)?.length || 0) > 0;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleSelectLevel3(cat.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition text-left cursor-pointer ${
                      isSelected
                        ? "bg-brand-dark text-white shadow-2xs font-bold"
                        : "text-slate-700 hover:bg-slate-100/80 hover:text-slate-900"
                    }`}
                  >
                    <span className="truncate pr-2">{cat.name}</span>
                    {hasKids ? (
                      <ChevronRight
                        className={`w-3.5 h-3.5 shrink-0 ${
                          isSelected ? "text-brand-light" : "text-slate-400"
                        }`}
                      />
                    ) : (
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                          isSelected ? "bg-white/20 text-white" : "text-slate-400"
                        }`}
                      >
                        Leaf
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Column 4: Level 4 Categories (Terminal Leaf) */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col h-[280px] sm:h-[320px] shadow-2xs">
          <div className="px-3 py-2 bg-slate-50/90 border-b border-slate-200 flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
              4. Item Type (Leaf)
            </span>
            <span className="text-[10px] text-slate-400 font-bold">{level4Categories.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-1 space-y-0.5">
            {!level3Id ? (
              <div className="h-full flex flex-col items-center justify-center p-4 text-center text-slate-300">
                <Package className="w-6 h-6 mb-1.5 opacity-50" />
                <span className="text-[11px]">Select product group</span>
              </div>
            ) : level4Categories.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-4 text-center text-slate-400">
                <CheckCircle2 className="w-5 h-5 mb-1 text-emerald-500" />
                <span className="text-xs font-bold text-slate-700">Target Level Reached</span>
                <span className="text-[10px] text-slate-400">Category is ready</span>
              </div>
            ) : (
              level4Categories.map((cat) => {
                const isSelected = level4Id === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleSelectLevel4(cat.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition text-left cursor-pointer ${
                      isSelected
                        ? "bg-brand-dark text-white shadow-2xs font-bold"
                        : "text-slate-700 hover:bg-slate-100/80 hover:text-slate-900"
                    }`}
                  >
                    <span className="truncate pr-2">{cat.name}</span>
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-brand-light shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ── Selected Category Breadcrumb & Confirmation Card ── */}
      {activeLeafCategory && (
        <div className="bg-white border-2 border-brand-light/60 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center space-x-3.5 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-brand-light/10 border border-brand-light/30 flex items-center justify-center text-brand-dark shrink-0 overflow-hidden">
              {activeLeafCategory.image_url ? (
                <img
                  src={activeLeafCategory.image_url}
                  alt={activeLeafCategory.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Package className="w-6 h-6" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <h4 className="text-sm font-extrabold text-slate-900 truncate">
                  {activeLeafCategory.name}
                </h4>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                  Ready
                </span>
              </div>
              <p className="text-xs text-brand-dark font-medium truncate mt-0.5">
                {activeBreadcrumb}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onSelectCategory(activeLeafCategory, activeBreadcrumb)}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl brand-gradient text-white font-bold text-xs shadow-md hover:shadow-lg transition-all flex items-center justify-center space-x-2 cursor-pointer active:scale-95 shrink-0"
          >
            <span>{actionButtonLabel}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
