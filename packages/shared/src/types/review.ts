export type ReviewStatus = "pending" | "approved" | "rejected";

export interface Review {
  id: string;
  product_id: string;
  user_id: string;
  rating: number;
  title?: string | null;
  body?: string | null;
  status: ReviewStatus;
  created_at: string;
  user_name?: string | null;
  product_name?: string | null;
  product_image?: string | null;
}
