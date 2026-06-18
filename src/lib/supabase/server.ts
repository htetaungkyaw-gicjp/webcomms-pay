import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import type { Database } from "@/types/database";

/**
 * Server (Server Component / Route Handler) Supabase client, RLS-respecting.
 * Next 16: cookies() is async. getAll/setAll is the current @supabase/ssr API.
 *
 * The setAll try/catch swallows the "called from a Server Component" error:
 * Server Components cannot set cookies, but middleware refreshes the session, so
 * the failed write there is harmless.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component — middleware handles the refresh.
          }
        },
      },
    },
  );
}
