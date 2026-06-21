import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Server-side caller resolution for Route Handlers. Returns the authenticated
 * user's profile (role/tenant/status) or a reason to reject. tenant_id is read
 * from the DB profile — the canonical "tenant_id is always server-derived" source.
 */
export type Caller = {
  userId: string;
  role: Database["public"]["Enums"]["user_role"];
  tenantId: string | null;
};

export async function getCaller(
  supabase: SupabaseClient<Database>,
): Promise<{ caller: Caller | null; status: number; error: string | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { caller: null, status: 401, error: "Not authenticated." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, status, tenant_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.status !== "active") {
    return { caller: null, status: 403, error: "No access." };
  }
  return {
    caller: { userId: user.id, role: profile.role, tenantId: profile.tenant_id },
    status: 200,
    error: null,
  };
}

/**
 * Lightweight header context for server-rendered pages: the signed-in email and
 * the caller's role, for AppHeader. Returns nulls if unauthenticated/no profile
 * (the page's own guard or the layout handles redirect/notFound).
 */
export async function getHeaderContext(
  supabase: SupabaseClient<Database>,
): Promise<{ email: string | null; role: Caller["role"] | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { email: null, role: null };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  return { email: user.email ?? null, role: profile?.role ?? null };
}

/** Require an active tenant_admin with a tenant. */
export async function requireTenantAdmin(
  supabase: SupabaseClient<Database>,
): Promise<{ caller: (Caller & { tenantId: string }) | null; status: number; error: string | null }> {
  const { caller, status, error } = await getCaller(supabase);
  if (!caller) return { caller: null, status, error };
  if (caller.role !== "tenant_admin" || !caller.tenantId) {
    return { caller: null, status: 403, error: "Tenant admins only." };
  }
  return { caller: { ...caller, tenantId: caller.tenantId }, status: 200, error: null };
}
