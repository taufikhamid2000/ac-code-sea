import type { NextApiRequest, NextApiResponse } from "next";
import { randomUUID } from "crypto";
import { getAdminClient } from "@/lib/supabase/admin";

function slugify(s: string): string {
  const base = s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base || "level";
}

function randSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}

/** Minimal server-side shape check on a submitted LevelDef. */
function validateLevelData(data: unknown): string | null {
  if (!data || typeof data !== "object") return "Missing level data.";
  const d = data as Record<string, unknown>;
  if (typeof d.title !== "string" || !d.title.trim()) return "Level needs a title.";
  if (!Array.isArray(d.platforms)) return "Malformed level (platforms).";
  if (!Array.isArray(d.enemies)) return "Malformed level (enemies).";
  if (typeof d.worldWidth !== "number") return "Malformed level (worldWidth).";
  return null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  let supabase;
  try {
    supabase = getAdminClient();
  } catch {
    return res.status(503).json({ error: "Level sharing is not configured." });
  }

  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("levels")
      .select("slug, title, chapter, author, plays, created_at")
      .eq("published", true)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ levels: data ?? [] });
  }

  if (req.method === "POST") {
    const body = req.body ?? {};
    const data = body.data;
    const validationError = validateLevelData(data);
    if (validationError) return res.status(400).json({ error: validationError });

    const title = String(body.title ?? (data as { title?: string }).title ?? "Untitled").slice(0, 120);
    const chapter = String(body.chapter ?? (data as { chapter?: string }).chapter ?? "").slice(0, 80);
    const author = String(body.author ?? "anonymous").trim().slice(0, 60) || "anonymous";
    const editToken = randomUUID();

    // Try a few times in case of a slug collision.
    for (let attempt = 0; attempt < 5; attempt++) {
      const slug = `${slugify(title)}-${randSuffix()}`;
      const { error } = await supabase.from("levels").insert({
        slug,
        title,
        chapter,
        author,
        data,
        edit_token: editToken,
        published: true,
      });
      if (!error) {
        return res.status(201).json({ slug, editToken });
      }
      // 23505 = unique_violation (slug clash) — retry with a new suffix.
      if (error.code !== "23505") {
        return res.status(500).json({ error: error.message });
      }
    }
    return res.status(500).json({ error: "Could not allocate a unique slug." });
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed." });
}
