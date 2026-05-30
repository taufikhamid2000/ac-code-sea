import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

/** Subscribe to the current Supabase Auth user. */
export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }
    const sb = getBrowserClient();
    sb.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
      setLoading(false);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { user, loading };
}

/** A friendly display name for an author byline. */
export function displayName(user: User | null): string {
  if (!user) return "anonymous";
  const meta = user.user_metadata ?? {};
  return (
    (meta.full_name as string) ||
    (meta.name as string) ||
    user.email?.split("@")[0] ||
    "anonymous"
  );
}
