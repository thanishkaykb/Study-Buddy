import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export async function ensureProfile(user: User) {
  const displayName =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    user.email?.split("@")[0] ??
    "Student";

  await supabase.from("profiles").upsert({
    id: user.id,
    email: user.email,
    display_name: displayName,
    avatar_url: (user.user_metadata?.avatar_url as string | undefined) ?? null,
  });
}
