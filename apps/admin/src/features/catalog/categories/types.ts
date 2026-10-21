import type { Category } from "@urbanrat/shared";

export interface CategoryWithMeta extends Category {
  level: number;
  fullPath: string;
  childrenCount: number;
  productCount?: number;
}

export type ModalState =
  | { type: "none" }
  | { type: "create"; parentId: string | null; targetLevel: number }
  | { type: "edit"; category: Category }
  | { type: "delete"; category: Category }
  | { type: "attributes"; category: Category };
