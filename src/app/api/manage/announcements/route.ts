import { NextResponse } from "next/server";
import { z } from "zod";
import sanitizeHtml from "sanitize-html";

import { createClient } from "@/lib/supabase/server";
import { requireTenantAdmin } from "@/lib/auth-guards";

/**
 * tenant_admin: create an announcement (rendered to all parents). Stored-XSS
 * defense (PLAN.md §Phase 3): announcements are plain text. We sanitize on the
 * way IN — stripping ALL tags — so even a raw render is safe, and the parent
 * view ALSO renders as escaped text (never dangerouslySetInnerHTML). Defense in
 * depth on top of the strict CSP backstop.
 *
 * author_id is set to the caller (server-side), not from the body.
 */
const Body = z.object({
  title: z.string().min(1).max(160),
  body: z.string().max(5000).default(""),
  isUrgent: z.boolean().default(false),
});

/** Strip every tag/attribute — announcements are plain text only. */
function plain(s: string): string {
  return sanitizeHtml(s, { allowedTags: [], allowedAttributes: {} }).trim();
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { caller, status, error } = await requireTenantAdmin(supabase);
  if (!caller) return NextResponse.json({ error }, { status });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid announcement." }, { status: 400 });
  }

  const title = plain(parsed.data.title);
  const body = plain(parsed.data.body);
  if (!title) {
    return NextResponse.json({ error: "Title is required." }, { status: 400 });
  }

  const { error: insErr } = await supabase.from("announcements").insert({
    tenant_id: caller.tenantId,
    author_id: caller.userId,
    title,
    body,
    is_urgent: parsed.data.isUrgent,
  });
  if (insErr) {
    return NextResponse.json({ error: "Could not post the announcement." }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
