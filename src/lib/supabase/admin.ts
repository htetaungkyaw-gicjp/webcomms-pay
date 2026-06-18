import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

/**
 * Service-role Supabase client — BYPASSES RLS. Use ONLY in Route Handlers, and
 * because it bypasses RLS, EVERY handler that uses it MUST re-authenticate the
 * caller AND authorize the specific resource (ownership/tenant checks) in code
 * before reading or writing. This is where IDOR / tampering bugs live.
 *
 * Never import this from a Client Component — it carries the service-role key.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
}
