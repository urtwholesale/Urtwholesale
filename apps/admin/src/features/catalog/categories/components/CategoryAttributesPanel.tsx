import { useState, useEffect } from "react";
import {
  Sparkles,
  Plus,
  ArrowUp,
  ArrowDown,
  Edit2,
  Trash2,
  Check,
  X,
  AlertCircle,
  Loader2,
  Layers,
  HelpCircle,
  Tag,
  Hash,
  Type,
  List,
  CheckSquare,
} from "lucide-react";
import type {
  Category,
  CategoryAttribute,
  CategoryAttributeType,
  InheritedCategoryAttribute,
} from "@urbanrat/shared";
import { triggerHaptic } from "../../../../utils/haptics";
import {
  fetchCategoryAttributes,
  fetchInheritedCategoryAttributes,
  saveCategoryAttribute,
  deleteCategoryAttribute,
  reorderCategoryAttributes,
} from "../../../../lib/adminService";

interface CategoryAttributesPanelProps {
  category: Category;
  categoryPath?: string;
  onClose?: () => void;
}

export function CategoryAttributesPanel({
  category,
  categoryPath,
  onClose,
}: CategoryAttributesPanelProps) {
  const [directAttributes, setDirectAttributes] = useState<CategoryAttribute[]>([]);
  const [inheritedAttributes, setInheritedAttributes] = useState<InheritedCategoryAttribute[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form Modal State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAttr, setEditingAttr] = useState<CategoryAttribute | null>(null);

  // Form Fields
  const [label, setLabel] = useState("");
  const [key, setKey] = useState("");
  const [type, setType] = useState<CategoryAttributeType>("text");
  const [options, setOptions] = useState<string[]>([]);
  const [newOptionInput, setNewOptionInput] = useState("");
  const [required, setRequired] = useState(false);
  const [applyToAll, setApplyToAll] = useState(true);
  const [helpText, setHelpText] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    loadAttributes();
  }, [category.id]);

  async function loadAttributes() {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const [direct, inherited] = await Promise.all([
        fetchCategoryAttributes(category.id),
        fetchInheritedCategoryAttributes(category.id),
      ]);
      setDirectAttributes(direct);
      setInheritedAttributes(inherited);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to load category attributes.");
    } finally {
      setIsLoading(false);
    }
  }

  function openCreateForm() {
    setEditingAttr(null);
    setLabel("");
    setKey("");
    setType("text");
    setOptions([]);
    setNewOptionInput("");
    setRequired(false);
    setApplyToAll(true);
    setHelpText("");
    setFormError(null);
    setIsFormOpen(true);
    triggerHaptic("selection");
  }

  function openEditForm(attr: CategoryAttribute) {
    setEditingAttr(attr);
    setLabel(attr.label);
    setKey(attr.key);
    setType(attr.type);
    setOptions(attr.options || []);
    setNewOptionInput("");
    setRequired(attr.required);
    setApplyToAll(attr.apply_to_all_products);
    setHelpText(attr.help_text || "");
    setFormError(null);
    setIsFormOpen(true);
    triggerHaptic("selection");
  }

  function handleLabelChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setLabel(val);
    if (!editingAttr || !key) {
      const slugKey = val
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/[\s_-]+/g, "_");
      setKey(slugKey);
    }
  }

  function handleAddOption() {
    const opt = newOptionInput.trim();
    if (opt && !options.includes(opt)) {
      setOptions([...options, opt]);
      setNewOptionInput("");
      triggerHaptic("light");
    }
  }

  function handleRemoveOption(optToRemove: string) {
    setOptions(options.filter((o) => o !== optToRemove));
    triggerHaptic("light");
  }

  async function handleSaveAttribute(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) {
      setFormError("Attribute label is required.");
      return;
    }

    if (!key.trim()) {
      setFormError("Attribute key is required.");
      return;
    }

    if ((type === "select" || type === "multiselect") && options.length === 0) {
      setFormError("Please provide at least one option choice for dropdown fields.");
      return;
    }

    try {
      setIsSaving(true);
      setFormError(null);
      await saveCategoryAttribute({
        id: editingAttr?.id,
        category_id: category.id,
        label: label.trim(),
        key: key.trim(),
        type,
        options,
        required,
        apply_to_all_products: applyToAll,
        help_text: helpText.trim() || null,
        sort_order: editingAttr ? editingAttr.sort_order : directAttributes.length,
      });

      triggerHaptic("success");
      setIsFormOpen(false);
      await loadAttributes();
    } catch (err: any) {
      setFormError(err.message || "Failed to save attribute.");
      triggerHaptic("heavy");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteAttribute(id: string) {
    if (!confirm("Are you sure you want to delete this attribute definition?")) return;
    try {
      await deleteCategoryAttribute(id);
      triggerHaptic("success");
      await loadAttributes();
    } catch (err: any) {
      alert(err.message || "Failed to delete attribute.");
    }
  }

  async function handleReorder(index: number, direction: "up" | "down") {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= directAttributes.length) return;

    const reordered = [...directAttributes];
    const [moved] = reordered.splice(index, 1);
    if (!moved) return;
    reordered.splice(targetIndex, 0, moved);
    setDirectAttributes(reordered);

    try {
      triggerHaptic("selection");
      await reorderCategoryAttributes(
        category.id,
        reordered.map((a) => a.id)
      );
    } catch (err) {
      await loadAttributes();
    }
  }

  function renderTypeIcon(t: CategoryAttributeType) {
    switch (t) {
      case "text":
        return <Type className="w-3.5 h-3.5" />;
      case "number":
        return <Hash className="w-3.5 h-3.5" />;
      case "select":
      case "multiselect":
        return <List className="w-3.5 h-3.5" />;
      case "boolean":
        return <CheckSquare className="w-3.5 h-3.5" />;
      default:
        return <Tag className="w-3.5 h-3.5" />;
    }
  }

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col h-full">
      {/* Panel Header */}
      <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-1.5 rounded-xl bg-brand-light/20 text-brand-dark">
              <Sparkles className="w-4 h-4 stroke-2" />
            </span>
            <div>
              <h2 className="text-sm font-black text-slate-900">
                Category Attributes: {category.name}
              </h2>
              <p className="text-[11px] text-slate-400 font-medium">
                {categoryPath || `Path: ${category.name}`}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={openCreateForm}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-brand-dark hover:bg-brand-dark/90 text-white text-xs font-bold transition shadow-xs active:scale-95 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-2.5" />
            <span>Add Attribute</span>
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Panel Body */}
      <div className="p-5 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
        {errorMessage && (
          <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {isLoading ? (
          <div className="py-16 flex flex-col items-center justify-center text-slate-400 space-y-2">
            <Loader2 className="w-6 h-6 animate-spin text-brand-dark" />
            <p className="text-xs font-semibold">Loading attribute specifications...</p>
          </div>
        ) : (
          <>
            {/* ── 1. Inherited Attributes Section (From Parent Categories) ── */}
            {inheritedAttributes.length > 0 && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Layers className="w-3.5 h-3.5 text-slate-400" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">
                      Inherited Attributes ({inheritedAttributes.length})
                    </h3>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium">
                    Read-only • Inherited from parent tree
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {inheritedAttributes.map((attr) => (
                    <div
                      key={attr.id}
                      className="p-3 rounded-2xl bg-slate-50 border border-slate-200/70 flex flex-col justify-between space-y-2"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center space-x-1.5">
                            <span className="text-xs font-bold text-slate-900">{attr.label}</span>
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white text-slate-500 border border-slate-200">
                              {attr.key}
                            </span>
                          </div>
                          {attr.help_text && (
                            <p className="text-[10px] text-slate-400 mt-0.5">{attr.help_text}</p>
                          )}
                        </div>
                        <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-200/80 text-slate-600 flex items-center space-x-1 shrink-0">
                          {renderTypeIcon(attr.type)}
                          <span className="capitalize">{attr.type}</span>
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[10px] pt-1.5 border-t border-slate-200/60">
                        <span className="text-brand-dark font-semibold">
                          From: {attr.inherited_from_category_name}
                        </span>
                        {attr.required && (
                          <span className="text-amber-700 font-bold bg-amber-50 px-1.5 py-0.2 rounded">
                            Required
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── 2. Direct Category Attributes Section ── */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Tag className="w-3.5 h-3.5 text-brand-dark" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                    Direct Attributes ({directAttributes.length})
                  </h3>
                </div>
                <span className="text-[10px] text-slate-400 font-medium">
                  Configured specifically for this category
                </span>
              </div>

              {directAttributes.length === 0 ? (
                <div className="p-8 rounded-3xl border border-dashed border-slate-200 text-center flex flex-col items-center justify-center">
                  <div className="w-10 h-10 rounded-2xl bg-brand-light/10 text-brand-dark flex items-center justify-center mb-2">
                    <Sparkles className="w-5 h-5 stroke-1.5" />
                  </div>
                  <p className="text-xs font-bold text-slate-800">No direct attributes defined</p>
                  <p className="text-[11px] text-slate-400 mt-0.5 mb-3 max-w-xs">
                    Define custom specifications (e.g., Wattage, Material, Cable Length) to collect when uploading products.
                  </p>
                  <button
                    type="button"
                    onClick={openCreateForm}
                    className="text-xs font-bold text-brand-dark bg-brand-light/20 hover:bg-brand-light/30 px-3.5 py-1.5 rounded-xl transition cursor-pointer flex items-center space-x-1"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-2" />
                    <span>Create First Attribute</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {directAttributes.map((attr, idx) => (
                    <div
                      key={attr.id}
                      className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs hover:border-slate-300 transition flex items-center justify-between group"
                    >
                      {/* Left: Reorder & Info */}
                      <div className="flex items-center space-x-3 min-w-0 flex-1">
                        {/* Reorder Buttons */}
                        <div className="flex flex-col space-y-0.5">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleReorder(idx, "up")}
                            className="p-0.5 rounded text-slate-400 hover:text-slate-700 disabled:opacity-20 cursor-pointer"
                            title="Move Up"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === directAttributes.length - 1}
                            onClick={() => handleReorder(idx, "down")}
                            className="p-0.5 rounded text-slate-400 hover:text-slate-700 disabled:opacity-20 cursor-pointer"
                            title="Move Down"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Attribute Info */}
                        <div className="min-w-0 flex-1 pr-2">
                          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                            <span className="text-xs font-bold text-slate-900">{attr.label}</span>
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                              {attr.key}
                            </span>
                            <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-brand-light/20 text-brand-dark flex items-center space-x-1">
                              {renderTypeIcon(attr.type)}
                              <span>{attr.type}</span>
                            </span>
                            {attr.required ? (
                              <span className="text-[9px] font-extrabold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded">
                                Required
                              </span>
                            ) : (
                              <span className="text-[9px] font-medium text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">
                                Optional
                              </span>
                            )}
                            {attr.apply_to_all_products && (
                              <span className="text-[9px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                                All Subcategories
                              </span>
                            )}
                          </div>

                          {/* Options preview for select / multiselect */}
                          {attr.options && attr.options.length > 0 && (
                            <div className="flex items-center space-x-1 mt-1.5 flex-wrap gap-y-1">
                              <span className="text-[10px] text-slate-400 font-medium mr-1">
                                Choices:
                              </span>
                              {attr.options.map((opt) => (
                                <span
                                  key={opt}
                                  className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200 text-slate-700"
                                >
                                  {opt}
                                </span>
                              ))}
                            </div>
                          )}

                          {attr.help_text && (
                            <p className="text-[10px] text-slate-400 mt-1 flex items-center space-x-1">
                              <HelpCircle className="w-3 h-3 shrink-0" />
                              <span className="truncate">{attr.help_text}</span>
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Right Actions */}
                      <div className="flex items-center space-x-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => openEditForm(attr)}
                          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-800 transition cursor-pointer"
                          title="Edit attribute"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteAttribute(attr.id)}
                          className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-300 hover:text-rose-600 transition cursor-pointer"
                          title="Delete attribute"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Add / Edit Attribute Modal ── */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-brand-light/20 text-brand-dark flex items-center justify-center font-bold">
                  <Sparkles className="w-4 h-4 stroke-2" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    {editingAttr ? "Edit Attribute" : "Add Category Attribute"}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium">
                    Category: {category.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="p-1.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAttribute} className="p-6 overflow-y-auto space-y-4">
              {formError && (
                <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Label */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Attribute Label <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={label}
                  onChange={handleLabelChange}
                  placeholder="e.g. Output Wattage"
                  required
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 focus:border-brand focus:ring-2 focus:ring-brand-light/30 text-xs font-medium text-slate-900 outline-none transition"
                />
              </div>

              {/* Key */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  System Key <span className="text-slate-400 font-normal">(auto-slugified)</span>
                </label>
                <div className="flex items-center px-3.5 py-2 rounded-2xl border border-slate-200 bg-slate-50/50 text-xs font-mono">
                  <span className="text-slate-400 mr-1">#</span>
                  <input
                    type="text"
                    value={key}
                    onChange={(e) => setKey(e.target.value.toLowerCase().replace(/[^\w-]/g, "_"))}
                    placeholder="output_wattage"
                    className="w-full bg-transparent outline-none text-slate-800 font-mono"
                  />
                </div>
              </div>

              {/* Type Select */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Data Type <span className="text-rose-500">*</span>
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as CategoryAttributeType)}
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 focus:border-brand focus:ring-2 focus:ring-brand-light/30 text-xs font-medium text-slate-900 outline-none transition bg-white"
                >
                  <option value="text">Text (Freeform string)</option>
                  <option value="number">Numeric (e.g. 65, 100)</option>
                  <option value="select">Dropdown Single Select</option>
                  <option value="multiselect">Dropdown Multi-Select</option>
                  <option value="boolean">Yes / No (Boolean)</option>
                </select>
              </div>

              {/* If select or multiselect, show choices builder */}
              {(type === "select" || type === "multiselect") && (
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                  <label className="block text-xs font-bold text-slate-800">
                    Dropdown Choices <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={newOptionInput}
                      onChange={(e) => setNewOptionInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddOption();
                        }
                      }}
                      placeholder="Type option and click Add..."
                      className="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddOption}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition cursor-pointer"
                    >
                      Add
                    </button>
                  </div>

                  {/* Pills */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {options.map((opt) => (
                      <span
                        key={opt}
                        className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-medium text-slate-800 shadow-2xs"
                      >
                        <span>{opt}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveOption(opt)}
                          className="hover:text-rose-600 text-slate-400 cursor-pointer ml-1"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Help Text */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Help / Guidance Text
                </label>
                <input
                  type="text"
                  value={helpText}
                  onChange={(e) => setHelpText(e.target.value)}
                  placeholder="e.g. Specify power in Watts, e.g. 65W or 100W"
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 focus:border-brand focus:ring-2 focus:ring-brand-light/30 text-xs font-medium text-slate-900 outline-none transition"
                />
              </div>

              {/* Checkboxes: Required & Apply to All */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="flex items-center space-x-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={required}
                    onChange={(e) => setRequired(e.target.checked)}
                    className="w-4 h-4 rounded text-brand-dark focus:ring-brand accent-brand-dark"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">Required Field</span>
                    <span className="text-[10px] text-slate-400">
                      Suppliers must fill this attribute when onboarding products
                    </span>
                  </div>
                </label>

                <label className="flex items-center space-x-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={applyToAll}
                    onChange={(e) => setApplyToAll(e.target.checked)}
                    className="w-4 h-4 rounded text-brand-dark focus:ring-brand accent-brand-dark"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">
                      Inherit in Subcategories
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Child categories under this node will automatically inherit this attribute
                    </span>
                  </div>
                </label>
              </div>

              {/* Form Footer */}
              <div className="pt-3 flex items-center justify-end space-x-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  disabled={isSaving}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl bg-brand-dark hover:bg-brand-dark/90 text-white text-xs font-bold transition shadow-xs flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Save Attribute</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
