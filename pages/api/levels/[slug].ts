import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminClient } from "@/lib/supabase/admin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  let supabase;
  try {
    supabase = getAdminClient();
  } catch {
    return res.status(503).json({ error: "Level sharing is not configured." });
  }

  const slug = String(req.query.slug ?? "");
  if (!slug) return res.status(400).json({ error: "Missing slug." });

  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("levels")
      .select("slug, title, chapter, author, plays, data, created_at, updated_at")
      .eq("slug", slug)
      .eq("published", true)
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: "Level not found." });

    // Count a play when the game loads it (best-effort, non-blocking).
    if (req.query.play === "1") {
      void supabase.rpc("increment_level_plays", { level_slug: slug });
    }
    return res.status(200).json({ level: data });
  }

  // Mutations require the per-level edit token.
  if (req.method === "PATCH" || req.method === "DELETE") {
    const token = String(req.body?.editToken ?? req.headers["x-edit-token"] ?? "");
    if (!token) return res.status(401).json({ error: "Missing edit token." });

    const { data: existing, error: fetchErr } = await supabase
      .from("levels")
      .select("id, edit_token")
      .eq("slug", slug)
      .maybeSingle();
    if (fetchErr) return res.status(500).json({ error: fetchErr.message });
    if (!existing) return res.status(404).json({ error: "Level not found." });
    if (existing.edit_token !== token) {
      return res.status(403).json({ error: "Edit token does not match." });
    }

    if (req.method === "DELETE") {
      const { error } = await supabase.from("levels").delete().eq("id", existing.id);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true });
    }

    // PATCH — update title/chapter/data/published.
    const body = req.body ?? {};
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.data !== undefined) patch.data = body.data;
    if (body.title !== undefined) patch.title = String(body.title).slice(0, 120);
    if (body.chapter !== undefined) patch.chapter = String(body.chapter).slice(0, 80);
    if (body.published !== undefined) patch.published = Boolean(body.published);

    const { error } = await supabase
      .from("levels")
      .update(patch)
      .eq("id", existing.id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  res.setHeader("Allow", "GET, PATCH, DELETE");
  return res.status(405).json({ error: "Method not allowed." });
}
