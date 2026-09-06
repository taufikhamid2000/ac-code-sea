import { useEffect } from "react";
import { useRouter } from "next/router";
import { useUser } from "@/lib/auth/useUser";
import { isSupabaseConfigured } from "@/lib/supabase/client";

/**
 * Redirects unauthenticated visitors to /login. If Supabase isn't
 * configured at all, auth is a no-op — nothing to gate against.
 */
export function useRequireUser() {
  const router = useRouter();
  const { user, loading } = useUser();
  const configured = isSupabaseConfigured();

  useEffect(() => {
    if (!configured || loading) return;
    if (!user) router.replace("/login");
  }, [configured, loading, user, router]);

  return { user, loading: configured ? loading || !user : false };
}
