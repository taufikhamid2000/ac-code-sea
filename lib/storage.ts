import { getBrowserClient } from "@/lib/supabase/client";

const BUCKET = "backdrops";
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB (matches the bucket limit)
const ALLOWED = ["image/png", "image/jpeg", "image/webp", "image/gif"];

/**
 * Upload a background image to Supabase Storage and return its public URL.
 * Stored under the user's id so policies can scope ownership.
 */
export async function uploadBackdrop(file: File, userId: string): Promise<string> {
  if (!ALLOWED.includes(file.type)) {
    throw new Error("Use a PNG, JPEG, WebP, or GIF image.");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("Image is too large (max 8 MB).");
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const rand = Math.random().toString(36).slice(2, 8);
  const path = `${userId}/${Date.now()}-${rand}.${ext}`;

  const sb = getBrowserClient();
  const { error } = await sb.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw new Error(error.message);

  const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
