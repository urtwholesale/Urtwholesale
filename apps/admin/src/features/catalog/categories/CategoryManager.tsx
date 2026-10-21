import { useState, useEffect, useMemo } from "react";
import {
  FolderTree,
  Plus,
  Search,
  RefreshCw,
  Folder,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Edit2,
  Trash2,
  AlertCircle,
  X,
} from "lucide-react";
import type { Category } from "@urbanrat/shared";
import { triggerHaptic } from "../../../utils/haptics";
import {
  fetchCategories,
  reorderCategories,
  toggleCategoryActive,
} from "../../../lib/adminService";
import { getCategoryBreadcrumb, getCategoryDepth } from "../utils/categoryTree";
import { CategoryColumn } from "./components/CategoryColumn";
import { CategoryEditModal } from "./components/CategoryEditModal";
import { CategoryDeleteModal } from "./components/CategoryDeleteModal";
import { CategoryAttributesPanel } from "./components/CategoryAttributesPanel";
import type { ModalState } from "./types";

export function CategoryManager() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Drill-down selection for up to 4 levels: [level1Id, level2Id, level3Id, level4Id]
  const [selectedIds, setSelectedIds] = useState<[string | null, string | null, string | null, string | null]>([
    null,
    null,
    null,
    null,
  ]);

  // Mobile Drill-down: Current active depth index (0 = root level 1, 1 = level 2, etc.)
  const [mobileLevel, setMobileLevel] = useState<number>(1);

  // Modal State
  const [modalState, setModalState] = useState<ModalState>({ type: "none" });

  // Attributes inspection panel category
  const [activeAttributesCategory, setActiveAttributesCategory] = useState<Category | null>(null);

  useEffect(() => {
    loadCategories();
  }, []);

  async function loadCategories() {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const data = await fetchCategories();
      setCategories(data);

      // Auto-select first root category if none selected
      if (!selectedIds[0] && data.length > 0) {
        const root = data.find((c) => !c.parent_id);
        if (root) {
          setSelectedIds([root.id, null, null, null]);
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to load categories.");
    } finally {
      setIsLoading(false);
    }
  }

  // Group categories by parent_id
  const categoriesByParent = useMemo(() => {
    const map = new Map<string | null, Category[]>();
    categories.forEach((cat) => {
      const pid = cat.parent_id || null;
      if (!map.has(pid)) map.set(pid, []);
      map.get(pid)!.push(cat);
    });
    return map;
  }, [categories]);

  // Level 1 Categories (Roots)
  const level1Categories = useMemo(() => {
    return categoriesByParent.get(null) || [];
  }, [categoriesByParent]);

  // Level 2 Categories (Children of selected Level 1)
  const level2Categories = useMemo(() => {
    return selectedIds[0] ? categoriesByParent.get(selectedIds[0]) || [] : [];
  }, [categoriesByParent, selectedIds]);

  // Level 3 Categories (Children of selected Level 2)
  const level3Categories = useMemo(() => {
    return selectedIds[1] ? categoriesByParent.get(selectedIds[1]) || [] : [];
  }, [categoriesByParent, selectedIds]);

  // Level 4 Categories (Children of selected Level 3)
  const level4Categories = useMemo(() => {
    return selectedIds[2] ? categoriesByParent.get(selectedIds[2]) || [] : [];
  }, [categoriesByParent, selectedIds]);

  // Currently focused leaf category (deepest selected)
  const selectedCategory = useMemo(() => {
    const deepestId = selectedIds[3] || selectedIds[2] || selectedIds[1] || selectedIds[0];
    return deepestId ? categories.find((c) => c.id === deepestId) || null : null;
  }, [selectedIds, categories]);

  // Filtered categories for Search
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return categories
      .filter((c) => c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q))
      .slice(0, 10);
  }, [searchQuery, categories]);

  // Jump tree to category
  function jumpToCategory(targetCat: Category) {
    // Resolve ancestor chain up to root
    const chain: string[] = [targetCat.id];
    let curr = targetCat;
    const catMap = new Map(categories.map((c) => [c.id, c]));

    while (curr.parent_id) {
      const parent = catMap.get(curr.parent_id);
      if (!parent) break;
      chain.unshift(parent.id);
      curr = parent;
    }

    const newSelection: [string | null, string | null, string | null, string | null] = [
      chain[0] || null,
      chain[1] || null,
      chain[2] || null,
      chain[3] || null,
    ];

    setSelectedIds(newSelection);
    setMobileLevel(chain.length);
    setSearchQuery("");
    setIsSearchFocused(false);
    triggerHaptic("success");
  }

  // Handle reorder
  async function handleReorderCategory(parentId: string | null, id: string, direction: "up" | "down") {
    const siblings = [...(categoriesByParent.get(parentId) || [])].sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name)
    );
    const index = siblings.findIndex((c) => c.id === id);
    if (index === -1) return;

    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= siblings.length) return;

    const [moved] = siblings.splice(index, 1);
    if (!moved) return;
    siblings.splice(targetIndex, 0, moved);

    const updates = siblings.map((cat, idx) => ({ id: cat.id, sort_order: idx }));

    // Optimistically update
    setCategories((prev) =>
      prev.map((cat) => {
        const u = updates.find((item) => item.id === cat.id);
        return u ? { ...cat, sort_order: u.sort_order } : cat;
      })
    );

    try {
      triggerHaptic("selection");
      await reorderCategories(updates);
    } catch {
      await loadCategories();
    }
  }

  // Handle toggle active
  async function handleToggleActive(id: string, currentActive: boolean) {
    const nextActive = !currentActive;
    setCategories((prev) =>
      prev.map((c) => (c.id === id ? { ...c, is_active: nextActive } : c))
    );
    try {
      triggerHaptic("selection");
      await toggleCategoryActive(id, nextActive);
    } catch {
      await loadCategories();
    }
  }

  return (
    <div className="space-y-5 pb-16">
      {/* ── Top Header & Search Bar ── */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-2xl bg-brand-light/20 text-brand-dark flex items-center justify-center font-black shadow-2xs">
              <FolderTree className="w-5 h-5 stroke-2" />
            </div>
            <div>
              <h1 className="text-base font-black text-slate-900 tracking-tight">
                Category Manager &amp; Hierarchy
              </h1>
              <p className="text-xs text-slate-400 font-medium">
                4-Level catalog tree with dynamic attribute schemas &amp; reordering
              </p>
            </div>
          </div>
        </div>

        {/* Search & Actions */}
        <div className="flex items-center space-x-2.5 flex-1 max-w-md relative">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              placeholder="Try Chargers, Earphones, Cables…"
              className="w-full pl-9 pr-8 py-2.5 rounded-2xl border border-slate-200 focus:border-brand focus:ring-2 focus:ring-brand-light/30 text-xs font-medium text-slate-800 outline-none transition bg-slate-50/50 focus:bg-white"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Search Dropdown Results */}
            {isSearchFocused && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-2xl shadow-xl border border-slate-200 z-30 max-h-72 overflow-y-auto p-1.5 space-y-1 animate-in fade-in duration-150">
                <div className="px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100">
                  Matching Categories ({searchResults.length})
                </div>
                {searchResults.map((result) => {
                  const depth = getCategoryDepth(result.id, categories);
                  const path = getCategoryBreadcrumb(result.id, categories);

                  return (
                    <div
                      key={result.id}
                      onMouseDown={() => jumpToCategory(result)}
                      className="p-2.5 rounded-xl hover:bg-slate-50 transition cursor-pointer flex items-center justify-between group"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center space-x-1.5">
                          <span className="text-xs font-bold text-slate-900 group-hover:text-brand-dark">
                            {result.name}
                          </span>
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                            Level {depth}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 font-medium truncate mt-0.5">
                          {path}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-brand-dark transition-transform group-hover:translate-x-0.5 shrink-0" />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={loadCategories}
            className="w-9 h-9 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-600 hover:text-slate-900 transition shadow-2xs active:scale-95 cursor-pointer shrink-0"
            title="Reload Categories"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-brand-dark" : ""}`} />
          </button>

          {/* Add Root Category Button */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic("selection");
              setModalState({ type: "create", parentId: null, targetLevel: 1 });
            }}
            className="px-4 py-2.5 rounded-2xl bg-brand-dark hover:bg-brand-dark/90 text-white text-xs font-bold transition shadow-xs flex items-center space-x-1.5 active:scale-95 cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5 stroke-2.5" />
            <span className="hidden sm:inline">Add Root Category</span>
          </button>
        </div>
      </div>

      {/* ── Error Banner ── */}
      {errorMessage && (
        <div className="p-4 rounded-3xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="font-medium">{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={loadCategories}
            className="text-xs font-bold underline hover:text-rose-900 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Breadcrumb Bar for Current Drill-Down Path ── */}
      {selectedCategory && (
        <div className="bg-white rounded-2xl border border-slate-200/80 px-4 py-2.5 flex items-center justify-between shadow-2xs flex-wrap gap-2">
          <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-600 flex-wrap">
            <span className="text-slate-400 font-medium">Selected Branch:</span>
            <span className="text-brand-dark font-extrabold">
              {getCategoryBreadcrumb(selectedCategory.id, categories)}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => {
                triggerHaptic("selection");
                setActiveAttributesCategory(selectedCategory);
              }}
              className="flex items-center space-x-1 px-3 py-1 rounded-xl bg-brand-light/20 hover:bg-brand-light/30 text-brand-dark text-xs font-bold transition cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 stroke-2" />
              <span>Attributes Schema</span>
            </button>

            <button
              type="button"
              onClick={() => {
                triggerHaptic("selection");
                setModalState({ type: "edit", category: selectedCategory });
              }}
              className="flex items-center space-x-1 px-3 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
            >
              <Edit2 className="w-3 h-3" />
              <span>Edit</span>
            </button>
          </div>
        </div>
      )}

      {/* ── DESKTOP VIEW: Multi-Column Finder Browser (>= md) ── */}
      <div className="hidden md:flex gap-4 overflow-x-auto pb-4 custom-scrollbar items-start">
        {/* Level 1: Main Categories */}
        <CategoryColumn
          level={1}
          levelTitle="Main Category (L1)"
          levelSubtitle="Root departments"
          categories={level1Categories}
          selectedId={selectedIds[0]}
          parentCategory={null}
          isParentSelected={true}
          onSelect={(cat) => {
            setSelectedIds([cat.id, null, null, null]);
          }}
          onAdd={() => setModalState({ type: "create", parentId: null, targetLevel: 1 })}
          onEdit={(cat) => setModalState({ type: "edit", category: cat })}
          onDelete={(cat) => setModalState({ type: "delete", category: cat })}
          onReorder={(id, dir) => handleReorderCategory(null, id, dir)}
          onToggleActive={(id, curr) => handleToggleActive(id, curr)}
          onOpenAttributes={(cat) => setActiveAttributesCategory(cat)}
        />

        {/* Level 2: Subcategories */}
        <CategoryColumn
          level={2}
          levelTitle="Subcategory (L2)"
          levelSubtitle="Product lines"
          categories={level2Categories}
          selectedId={selectedIds[1]}
          parentCategory={categories.find((c) => c.id === selectedIds[0])}
          isParentSelected={Boolean(selectedIds[0])}
          onSelect={(cat) => {
            setSelectedIds([selectedIds[0], cat.id, null, null]);
          }}
          onAdd={(pid) => setModalState({ type: "create", parentId: pid, targetLevel: 2 })}
          onEdit={(cat) => setModalState({ type: "edit", category: cat })}
          onDelete={(cat) => setModalState({ type: "delete", category: cat })}
          onReorder={(id, dir) => handleReorderCategory(selectedIds[0], id, dir)}
          onToggleActive={(id, curr) => handleToggleActive(id, curr)}
          onOpenAttributes={(cat) => setActiveAttributesCategory(cat)}
        />

        {/* Level 3: Product Groups */}
        <CategoryColumn
          level={3}
          levelTitle="Product Group (L3)"
          levelSubtitle="Technical families"
          categories={level3Categories}
          selectedId={selectedIds[2]}
          parentCategory={categories.find((c) => c.id === selectedIds[1])}
          isParentSelected={Boolean(selectedIds[1])}
          onSelect={(cat) => {
            setSelectedIds([selectedIds[0], selectedIds[1], cat.id, null]);
          }}
          onAdd={(pid) => setModalState({ type: "create", parentId: pid, targetLevel: 3 })}
          onEdit={(cat) => setModalState({ type: "edit", category: cat })}
          onDelete={(cat) => setModalState({ type: "delete", category: cat })}
          onReorder={(id, dir) => handleReorderCategory(selectedIds[1], id, dir)}
          onToggleActive={(id, curr) => handleToggleActive(id, curr)}
          onOpenAttributes={(cat) => setActiveAttributesCategory(cat)}
        />

        {/* Level 4: Item Varieties */}
        <CategoryColumn
          level={4}
          levelTitle="Item Variety (L4)"
          levelSubtitle="Specific leaf styles"
          categories={level4Categories}
          selectedId={selectedIds[3]}
          parentCategory={categories.find((c) => c.id === selectedIds[2])}
          isParentSelected={Boolean(selectedIds[2])}
          onSelect={(cat) => {
            setSelectedIds([selectedIds[0], selectedIds[1], selectedIds[2], cat.id]);
          }}
          onAdd={(pid) => setModalState({ type: "create", parentId: pid, targetLevel: 4 })}
          onEdit={(cat) => setModalState({ type: "edit", category: cat })}
          onDelete={(cat) => setModalState({ type: "delete", category: cat })}
          onReorder={(id, dir) => handleReorderCategory(selectedIds[2], id, dir)}
          onToggleActive={(id, curr) => handleToggleActive(id, curr)}
          onOpenAttributes={(cat) => setActiveAttributesCategory(cat)}
        />
      </div>

      {/* ── MOBILE VIEW: Stacked Drill-Down List (< md) ── */}
      <div className="md:hidden space-y-3">
        {/* Mobile Navigation Header */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-3 flex items-center justify-between shadow-2xs">
          <div className="flex items-center space-x-2">
            {mobileLevel > 1 && (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("selection");
                  const nextLevel = mobileLevel - 1;
                  setMobileLevel(nextLevel);
                  if (nextLevel === 1) setSelectedIds([selectedIds[0], null, null, null]);
                  else if (nextLevel === 2) setSelectedIds([selectedIds[0], selectedIds[1], null, null]);
                  else if (nextLevel === 3) setSelectedIds([selectedIds[0], selectedIds[1], selectedIds[2], null]);
                }}
                className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                title="Go Back"
              >
                <ChevronLeft className="w-4 h-4 stroke-2" />
              </button>
            )}
            <div>
              <span className="text-xs font-black text-slate-900 block">
                Level {mobileLevel} Categories
              </span>
              <span className="text-[10px] text-slate-400">
                {mobileLevel === 1
                  ? "Root departments"
                  : mobileLevel === 2
                  ? `Under ${categories.find((c) => c.id === selectedIds[0])?.name || ""}`
                  : mobileLevel === 3
                  ? `Under ${categories.find((c) => c.id === selectedIds[1])?.name || ""}`
                  : `Under ${categories.find((c) => c.id === selectedIds[2])?.name || ""}`}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              triggerHaptic("selection");
              const parentId =
                mobileLevel === 1
                  ? null
                  : mobileLevel === 2
                  ? selectedIds[0]
                  : mobileLevel === 3
                  ? selectedIds[1]
                  : selectedIds[2];
              setModalState({ type: "create", parentId, targetLevel: mobileLevel });
            }}
            className="px-3 py-1.5 rounded-xl bg-brand-dark text-white text-xs font-bold flex items-center space-x-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add</span>
          </button>
        </div>

        {/* Current Mobile Level Items */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-3 space-y-2 shadow-xs">
          {(() => {
            const currentList =
              mobileLevel === 1
                ? level1Categories
                : mobileLevel === 2
                ? level2Categories
                : mobileLevel === 3
                ? level3Categories
                : level4Categories;

            if (currentList.length === 0) {
              return (
                <div className="py-12 text-center text-slate-400 text-xs font-medium">
                  No categories at this level. Tap Add to create one.
                </div>
              );
            }

            return currentList.map((cat) => {
              const children = categoriesByParent.get(cat.id) || [];
              const hasChildren = children.length > 0;

              return (
                <div
                  key={cat.id}
                  className="p-3 rounded-2xl border border-slate-200/80 hover:border-slate-300 bg-white flex items-center justify-between shadow-2xs"
                >
                  <div
                    onClick={() => {
                      triggerHaptic("selection");
                      if (mobileLevel === 1) {
                        setSelectedIds([cat.id, null, null, null]);
                        setMobileLevel(2);
                      } else if (mobileLevel === 2) {
                        setSelectedIds([selectedIds[0], cat.id, null, null]);
                        setMobileLevel(3);
                      } else if (mobileLevel === 3) {
                        setSelectedIds([selectedIds[0], selectedIds[1], cat.id, null]);
                        setMobileLevel(4);
                      } else {
                        setSelectedIds([selectedIds[0], selectedIds[1], selectedIds[2], cat.id]);
                      }
                    }}
                    className="flex items-center space-x-3 min-w-0 flex-1 cursor-pointer"
                  >
                    <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden">
                      {cat.image_url ? (
                        <img src={cat.image_url} alt={cat.name} className="w-full h-full object-cover" />
                      ) : (
                        <Folder className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-bold text-slate-900 block truncate">
                        {cat.name}
                      </span>
                      <span className="text-[10px] text-slate-400 block truncate">
                        {hasChildren ? `${children.length} subcategories` : "Leaf item"}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setActiveAttributesCategory(cat)}
                      className="p-2 rounded-xl text-brand-dark hover:bg-brand-light/10"
                      title="Attributes"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setModalState({ type: "edit", category: cat })}
                      className="p-2 rounded-xl text-slate-400 hover:text-slate-700"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setModalState({ type: "delete", category: cat })}
                      className="p-2 rounded-xl text-slate-300 hover:text-rose-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            });
          })()}
        </div>
      </div>

      {/* ── Attributes Side/Bottom Panel (Active When User clicks Attributes) ── */}
      {activeAttributesCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-4xl h-[90vh] bg-white rounded-4xl shadow-2xl overflow-hidden flex flex-col border border-slate-200">
            <CategoryAttributesPanel
              category={activeAttributesCategory}
              categoryPath={getCategoryBreadcrumb(activeAttributesCategory.id, categories)}
              onClose={() => setActiveAttributesCategory(null)}
            />
          </div>
        </div>
      )}

      {/* ── Create / Edit Category Modal ── */}
      <CategoryEditModal
        isOpen={modalState.type === "create" || modalState.type === "edit"}
        onClose={() => setModalState({ type: "none" })}
        onSaved={async () => {
          await loadCategories();
        }}
        categoryToEdit={modalState.type === "edit" ? modalState.category : null}
        defaultParentId={modalState.type === "create" ? modalState.parentId : null}
        allCategories={categories}
      />

      {/* ── Delete Category Modal ── */}
      <CategoryDeleteModal
        isOpen={modalState.type === "delete"}
        onClose={() => setModalState({ type: "none" })}
        onDeleted={async () => {
          await loadCategories();
        }}
        category={modalState.type === "delete" ? modalState.category : null}
      />
    </div>
  );
}
