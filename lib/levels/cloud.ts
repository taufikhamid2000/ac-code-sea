import type { User } from "@supabase/supabase-js";
import { getBrowserClient } from "@/lib/supabase/client";
import { displayName } from "@/lib/auth/useUser";
import type { LevelDef } from "./types";

export type LevelSummary = {
  slug: string;
  title: string;
  chapter: string;
  author: string;
  plays: number;
  created_at: string;
  user_id: string | null;
};

export type LevelRow = LevelSummary & { data: LevelDef };

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

const SUMMARY_COLS = "slug, title, chapter, author, plays, created_at, user_id";

/** Published levels, newest first. */
export async function listPublished(): Promise<LevelSummary[]> {
  const sb = getBrowserClient();
  const { data, error } = await sb
    .from("levels")
    .select(SUMMARY_COLS)
    .eq("published", true)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []) as LevelSummary[];
}

/** Levels owned by a user (published or not). */
export async function listMine(userId: string): Promise<LevelSummary[]> {
  const sb = getBrowserClient();
  const { data, error } = await sb
    .from("levels")
    .select(SUMMARY_COLS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as LevelSummary[];
}

/** Load one level by slug and (best-effort) count a play. */
export async function loadBySlug(slug: string): Promise<LevelRow> {
  const sb = getBrowserClient();
  const { data, error } = await sb
    .from("levels")
    .select(`${SUMMARY_COLS}, data`)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Level not found.");
  void sb.rpc("increment_level_plays", { level_slug: slug });
  return data as LevelRow;
}

/** Publish a new level owned by the given user. Returns the new slug. */
export async function publishLevel(
  level: LevelDef,
  user: User
): Promise<string> {
  const sb = getBrowserClient();
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = `${slugify(level.title)}-${randSuffix()}`;
    const { error } = await sb.from("levels").insert({
      slug,
      title: level.title,
      chapter: level.chapter,
      author: displayName(user),
      data: level,
      user_id: user.id,
      published: true,
    });
    if (!error) return slug;
    if (error.code !== "23505") throw new Error(error.message); // not a slug clash
  }
  throw new Error("Could not allocate a unique slug.");
}

/** Update a level you own. */
export async function updateLevel(slug: string, level: LevelDef): Promise<void> {
  const sb = getBrowserClient();
  const { error } = await sb
    .from("levels")
    .update({
      title: level.title,
      chapter: level.chapter,
      data: level,
      updated_at: new Date().toISOString(),
    })
    .eq("slug", slug);
  if (error) throw new Error(error.message);
}

/** Delete a level you own. */
export async function deleteLevel(slug: string): Promise<void> {
  const sb = getBrowserClient();
  const { error } = await sb.from("levels").delete().eq("slug", slug);
  if (error) throw new Error(error.message);
}
