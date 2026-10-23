import {
  Folder,
  Plus,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  Edit2,
  Trash2,
  Layers,
  Sparkles,
  Eye,
  EyeOff,
} from "lucide-react";
import type { Category } from "@urbanrat/shared";
import { triggerHaptic } from "../../../../utils/haptics";

interface CategoryColumnProps {
  level: number;
  levelTitle: string;
  levelSubtitle: string;
  categories: Category[];
  selectedId: string | null;
  parentCategory: Category | null | undefined;
  isParentSelected: boolean;
  onSelect: (category: Category) => void;
  onAdd: (parentId: string | null, level: number) => void;
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
  onReorder: (id: string, direction: "up" | "down") => void;
  onToggleActive: (id: string, currentActive: boolean) => void;
  onOpenAttributes: (category: Category) => void;
}

export function CategoryColumn({
  level,
  levelTitle,
  levelSubtitle,
  categories,
  selectedId,
  parentCategory,
  isParentSelected,
  onSelect,
  onAdd,
  onEdit,
  onDelete,
  onReorder,
  onToggleActive,
  onOpenAttributes,
}: CategoryColumnProps) {
  // If this is Level > 1 and no parent has been selected in the previous level, show idle empty state
  if (level > 1 && !isParentSelected) {
    return (
      <div className="flex-1 min-w-[280px] max-w-[340px] bg-white rounded-3xl border border-slate-200/80 p-5 flex flex-col justify-center items-center text-center shadow-xs">
        <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200/60 flex items-center justify-center text-slate-300 mb-3">
          <Layers className="w-6 h-6 stroke-1.5" />
        </div>
        <p className="text-xs font-bold text-slate-700 mb-1">{levelTitle}</p>
        <p className="text-[11px] text-slate-400 max-w-50">
          Select a category in Level {level - 1} to inspect and manage subcategories.
        </p>
      </div>
    );
  }

  const sortedCategories = [...categories].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name)
  );

  const levelBadgeClass =
    level === 1
      ? "bg-sky-100 text-sky-800 border-sky-200/80"
      : level === 2
      ? "bg-teal-100 text-teal-800 border-teal-200/80"
      : level === 3
      ? "bg-indigo-100 text-indigo-800 border-indigo-200/80"
      : "bg-emerald-100 text-emerald-800 border-emerald-200/80";

  return (
    <div className="flex-1 min-w-[280px] max-w-[340px] bg-white rounded-3xl border border-slate-200/80 flex flex-col shadow-xs overflow-hidden">
      {/* Column Header */}
      <div className="p-4 pb-3 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center space-x-2">
            <span
              className={`w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-black border ${levelBadgeClass}`}
            >
              L{level}
            </span>
            <h3 className="text-xs font-black text-slate-900 tracking-tight">{levelTitle}</h3>
          </div>
          <span className="text-[10px] font-bold text-slate-400 bg-white border border-slate-200/60 px-2 py-0.5 rounded-full shadow-2xs">
            {sortedCategories.length} {sortedCategories.length === 1 ? "item" : "items"}
          </span>
        </div>

        <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium">
          <span className="truncate pr-2">
            {level === 1
              ? levelSubtitle
              : parentCategory
              ? `Under: ${parentCategory.name}`
              : levelSubtitle}
          </span>
          <button
            type="button"
            onClick={() => {
              triggerHaptic("selection");
              onAdd(parentCategory?.id || null, level);
            }}
            className="flex items-center space-x-1 text-brand-dark hover:text-brand font-bold bg-white hover:bg-slate-50 border border-brand/20 px-2 py-0.5 rounded-lg shadow-2xs transition active:scale-95 cursor-pointer shrink-0"
            title={`Add Level ${level} Category`}
          >
            <Plus className="w-3 h-3 stroke-2.5" />
            <span>Add</span>
          </button>
        </div>
      </div>

      {/* Column Content List */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5 min-h-[360px] max-h-[640px] custom-scrollbar">
        {sortedCategories.length === 0 ? (
          <div className="h-full py-16 flex flex-col items-center justify-center text-center p-4">
            <div className="w-10 h-10 rounded-2xl bg-slate-50 border border-dashed border-slate-200 flex items-center justify-center text-slate-300 mb-2">
              <Folder className="w-5 h-5 stroke-1.5" />
            </div>
            <p className="text-xs font-bold text-slate-700">No categories</p>
            <p className="text-[10px] text-slate-400 mt-0.5 mb-3">
              This branch has no subcategories yet.
            </p>
            <button
              type="button"
              onClick={() => {
                triggerHaptic("selection");
                onAdd(parentCategory?.id || null, level);
              }}
              className="text-[11px] font-bold text-brand-dark bg-brand-light/15 hover:bg-brand-light/25 px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center space-x-1"
            >
              <Plus className="w-3.5 h-3.5 stroke-2" />
              <span>Create Category</span>
            </button>
          </div>
        ) : (
          sortedCategories.map((cat, idx) => {
            const isSelected = selectedId === cat.id;

            return (
              <div
                key={cat.id}
                onClick={() => {
                  triggerHaptic("selection");
                  onSelect(cat);
                }}
                className={`group relative rounded-2xl p-2.5 transition-all cursor-pointer border flex items-center justify-between ${
                  isSelected
                    ? "bg-gradient-to-r from-sky-50 via-teal-50/70 to-white text-slate-900 border-brand-dark/40 ring-1 ring-brand-dark/25 shadow-xs"
                    : "bg-white hover:bg-slate-50/90 text-slate-800 border-slate-200/80 hover:border-slate-300 shadow-2xs"
                }`}
              >
                {/* Left: Thumbnail & Name */}
                <div className="flex items-center space-x-2.5 min-w-0 flex-1 pr-1.5">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 overflow-hidden border transition-colors ${
                      isSelected
                        ? "bg-white border-brand-dark/30 shadow-2xs ring-1 ring-brand-dark/20"
                        : "bg-slate-50 border-slate-200/80"
                    }`}
                  >
                    {cat.image_url ? (
                      <img
                        src={cat.image_url}
                        alt={cat.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Folder
                        className={`w-4 h-4 ${
                          isSelected ? "text-brand-dark" : "text-slate-400"
                        }`}
                      />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center space-x-1.5">
                      <span
                        className={`text-xs truncate block ${
                          isSelected ? "font-extrabold text-slate-900" : "font-bold text-slate-800"
                        }`}
                        title={cat.name}
                      >
                        {cat.name}
                      </span>
                      {!cat.is_active && (
                        <span
                          className={`text-[8px] font-extrabold uppercase px-1 rounded shrink-0 ${
                            isSelected
                              ? "bg-amber-100/90 text-amber-900 border border-amber-300"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          Inactive
                        </span>
                      )}
                    </div>
                    <span
                      className={`text-[10px] truncate block ${
                        isSelected ? "font-medium text-brand-dark/90" : "font-medium text-slate-400"
                      }`}
                      title={`/${cat.slug}`}
                    >
                      /{cat.slug}
                    </span>
                  </div>
                </div>

                {/* Right: Actions on Hover & Selected Arrow */}
                <div className="flex items-center space-x-1 shrink-0">
                  {/* Action Buttons (Reveal on Hover) */}
                  <div
                    className="flex items-center space-x-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => onReorder(cat.id, "up")}
                      className="p-1 rounded-md transition disabled:opacity-20 cursor-pointer hover:bg-slate-200/80 text-slate-500 hover:text-slate-800"
                      title="Move up"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === sortedCategories.length - 1}
                      onClick={() => onReorder(cat.id, "down")}
                      className="p-1 rounded-md transition disabled:opacity-20 cursor-pointer hover:bg-slate-200/80 text-slate-500 hover:text-slate-800"
                      title="Move down"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        triggerHaptic("selection");
                        onOpenAttributes(cat);
                      }}
                      className="p-1.5 rounded-lg transition cursor-pointer hover:bg-brand-light/15 text-brand-dark"
                      title="Manage Category Attributes"
                    >
                      <Sparkles className="w-3.5 h-3.5 stroke-2" />
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        triggerHaptic("selection");
                        onToggleActive(cat.id, cat.is_active);
                      }}
                      className={`p-1.5 rounded-lg transition cursor-pointer ${
                        cat.is_active
                          ? "hover:bg-slate-100 text-slate-400 hover:text-slate-700"
                          : "hover:bg-amber-100 text-amber-600"
                      }`}
                      title={cat.is_active ? "Deactivate category" : "Activate category"}
                    >
                      {cat.is_active ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        triggerHaptic("selection");
                        onEdit(cat);
                      }}
                      className="p-1.5 rounded-lg transition cursor-pointer hover:bg-slate-100 text-slate-400 hover:text-slate-700"
                      title="Edit Category"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        triggerHaptic("heavy");
                        onDelete(cat);
                      }}
                      className="p-1.5 rounded-lg transition cursor-pointer hover:bg-rose-100 text-slate-300 hover:text-rose-600"
                      title="Delete Category"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Selected right indicator */}
                  {isSelected ? (
                    <div className="w-5 h-5 rounded-full bg-brand-dark flex items-center justify-center text-white shadow-xs ml-0.5 shrink-0">
                      <ChevronRight className="w-3.5 h-3.5 stroke-3" />
                    </div>
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-slate-300 ml-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
