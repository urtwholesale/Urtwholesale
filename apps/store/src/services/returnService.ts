import { supabase } from "../lib/supabase";
import type {
  ReturnRequest,
  CreateReturnRequestInput,
} from "@urbanrat/shared";
import { compressImage } from "../utils/imageCompressor";

export class ReturnServiceError extends Error {
  constructor(
    message: string,
    public code?: string,
    public originalError?: unknown
  ) {
    super(message);
    this.name = "ReturnServiceError";
  }
}

/**
 * Creates a return, replacement, or refund request via security-definer RPC
 */
export async function createReturnRequest(
  input: CreateReturnRequestInput
): Promise<ReturnRequest> {
  const { data, error } = await supabase.rpc("create_return_request", {
    p_order_id: input.order_id.trim(),
    p_items: input.items,
    p_type: input.type,
    p_reason: input.reason,
    p_description: input.description?.trim() || null,
    p_evidence_paths: input.evidence_paths || [],
  });

  if (error) {
    if (
      error.code === "PGRST202" ||
      error.message?.includes("create_return_request") ||
      error.message?.includes("schema cache")
    ) {
      throw new ReturnServiceError(
        "Returns backend is not yet active in database. Please run migration 012_returns_backend.sql in Supabase SQL editor.",
        error.code,
        error
      );
    }
    throw new ReturnServiceError(error.message, error.code, error);
  }

  return data as ReturnRequest;
}

/**
 * Fetches all return requests for the authenticated customer with items and events
 */
export async function listCustomerReturns(): Promise<ReturnRequest[]> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return [];

  const { data, error } = await supabase
    .from("return_requests")
    .select(`
      *,
      items:return_items(
        *,
        product:products(id, name, sku, images, price)
      ),
      events:return_events(*)
    `)
    .eq("user_id", auth.user.id)
    .order("requested_at", { ascending: false });

  if (error) {
    if (
      error.code === "PGRST205" ||
      error.code === "42P01" ||
      error.message?.includes("return_requests") ||
      error.message?.includes("schema cache")
    ) {
      console.warn(
        "return_requests table is not available in Supabase schema cache yet. Returning empty array."
      );
      return [];
    }
    throw new ReturnServiceError(error.message, error.code, error);
  }

  // Sort events chronologically inside each request
  return ((data || []) as ReturnRequest[]).map((ret) => ({
    ...ret,
    events: (ret.events || []).sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    ),
  }));
}

/**
 * Fetches a single return request by UUID or Return Code (RET-YYMMDD-XXXX)
 */
export async function getReturnById(idOrCode: string): Promise<ReturnRequest | null> {
  const clean = idOrCode.trim();
  if (!clean) return null;

  let query = supabase
    .from("return_requests")
    .select(`
      *,
      items:return_items(
        *,
        product:products(id, name, sku, images, price)
      ),
      events:return_events(*)
    `);

  // Detect whether clean is a UUID or return_code
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clean);

  if (isUuid) {
    query = query.eq("id", clean);
  } else {
    query = query.eq("return_code", clean.toUpperCase());
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    if (
      error.code === "PGRST205" ||
      error.code === "42P01" ||
      error.message?.includes("return_requests") ||
      error.message?.includes("schema cache")
    ) {
      console.warn("return_requests table is not available in Supabase schema cache yet.");
      return null;
    }
    throw new ReturnServiceError(error.message, error.code, error);
  }

  if (!data) return null;

  const returnReq = data as ReturnRequest;
  return {
    ...returnReq,
    events: (returnReq.events || []).sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    ),
  };
}

/**
 * Uploads a photo or video to private return-evidence storage bucket.
 * Compresses images to WebP prior to upload.
 */
export async function uploadReturnEvidence(
  file: File,
  userId: string
): Promise<string> {
  let fileToUpload = file;

  // Compress images to WebP
  if (file.type.startsWith("image/")) {
    try {
      const comp = await compressImage(file, {
        maxWidth: 1600,
        maxHeight: 1600,
        quality: 0.82,
        mimeType: "image/webp",
      });
      fileToUpload = comp.file;
    } catch (e) {
      console.warn("Client image compression skipped, uploading original:", e);
    }
  }

  const cleanName = fileToUpload.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const filePath = `${userId}/${Date.now()}_${randomSuffix}_${cleanName}`;

  const { error } = await supabase.storage
    .from("return-evidence")
    .upload(filePath, fileToUpload, {
      cacheControl: "3600",
      upsert: false,
    });

  if (error) {
    throw new ReturnServiceError(error.message, "UPLOAD_FAILED", error);
  }

  return filePath;
}

/**
 * Generates a temporary signed URL to view private return evidence
 */
export async function getReturnEvidenceUrl(filePath: string): Promise<string> {
  if (!filePath) return "";
  if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
    return filePath;
  }

  try {
    const { data, error } = await supabase.storage
      .from("return-evidence")
      .createSignedUrl(filePath, 3600); // 1-hour signed URL

    if (!error && data?.signedUrl) {
      return data.signedUrl;
    }
  } catch (err) {
    console.error("Failed to create signed URL:", err);
  }

  // Fallback to public URL format if signed URL failed
  const { data } = supabase.storage
    .from("return-evidence")
    .getPublicUrl(filePath);

  return data.publicUrl;
}

/**
 * Fetches the user's return requests mapped by order_id for quick badge lookups
 */
export async function fetchOrderReturnsMap(): Promise<Record<string, ReturnRequest>> {
  try {
    const list = await listCustomerReturns();
    const map: Record<string, ReturnRequest> = {};
    for (const r of list) {
      // Keep the most recent or active return per order
      if (!map[r.order_id] || new Date(r.requested_at) > new Date(map[r.order_id]!.requested_at)) {
        map[r.order_id] = r;
      }
    }
    return map;
  } catch (err) {
    console.error("Failed to fetch order returns map:", err);
    return {};
  }
}
