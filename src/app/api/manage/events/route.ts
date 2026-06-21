import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { requireTenantAdmin } from "@/lib/auth-guards";

/**
 * tenant_admin: create a calendar event. User-scoped client → events_write RLS
 * enforces tenant_id = caller's tenant. Times are ISO timestamps (timestamptz).
 */
const Body = z.object({
  title: z.string().min(1).max(160),
  description: z.string().max(2000).default(""),
  eventType: z.enum(["general", "holiday", "exam", "activity", "meeting"]).default("general"),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { caller, status, error } = await requireTenantAdmin(supabase);
  if (!caller) return NextResponse.json({ error }, { status });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid event." }, { status: 400 });
  }
  const { title, description, eventType, startsAt, endsAt } = parsed.data;
  if (new Date(endsAt) < new Date(startsAt)) {
    return NextResponse.json({ error: "End must be after start." }, { status: 400 });
  }

  const { error: insErr } = await supabase.from("events").insert({
    tenant_id: caller.tenantId,
    title,
    description,
    event_type: eventType,
    starts_at: startsAt,
    ends_at: endsAt,
  });
  if (insErr) {
    return NextResponse.json({ error: "Could not create the event." }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
