import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Append-only audit log writer (PLAN.md §1-G). Called from admin-client Route
 * Handlers for security-relevant events: invitation create/accept, role/status
 * change, student create/delete, data export, erasure, and admin reads of
 * student/invoice data.
 *
 * MUST be passed the SERVICE-ROLE client (audit_log has no INSERT policy for
 * authenticated — writes come from service_role, which bypasses RLS). Best-effort:
 * a failed audit write is logged but never blocks the primary action, EXCEPT the
 * caller decides — we return the error so security-critical paths can react.
 *
 * NEVER log secrets or full PII bodies in `metadata` — keep it to ids/flags.
 */
export type AuditEntry = {
  tenantId: string | null;
  actorId: string | null;
  actorRole: Database["public"]["Enums"]["user_role"] | null;
  action: string;
  targetTable?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
};

export async function writeAudit(
  admin: SupabaseClient<Database>,
  entry: AuditEntry,
): Promise<{ error: string | null }> {
  const { error } = await admin.from("audit_log").insert({
    tenant_id: entry.tenantId,
    actor_id: entry.actorId,
    actor_role: entry.actorRole,
    action: entry.action,
    target_table: entry.targetTable ?? null,
    target_id: entry.targetId ?? null,
    metadata: (entry.metadata ?? {}) as Database["public"]["Tables"]["audit_log"]["Insert"]["metadata"],
  });
  if (error) {
    console.error("[audit] failed to write entry:", entry.action, error.message);
    return { error: error.message };
  }
  return { error: null };
}
