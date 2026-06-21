import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getCaller } from "@/lib/auth-guards";

/**
 * Parent acknowledges an announcement ("Noted"). parent_id is set to the
 * authenticated caller SERVER-SIDE (never from the client), and the INSERT goes
 * through the user-scoped client so the immutable INSERT-only ack RLS
 * (ack_insert_self: parent_id = auth.uid() AND announcement in your tenant) is
 * the boundary. Idempotent: the (announcement_id, parent_id) unique constraint
 * means a repeat "Noted" is a harmless no-op (we ignore 23505).
 */
const Body = z.object({ announcementId: z.string().uuid() });

export async function POST(request: Request) {
  const supabase = await createClient();
  const { caller, status, error } = await getCaller(supabase);
  if (!caller) return NextResponse.json({ error }, { status });
  if (caller.role !== "parent") {
    return NextResponse.json({ error: "Parents only." }, { status: 403 });
  }

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { error: insErr } = await supabase
    .from("announcement_acknowledgements")
    .insert({ announcement_id: parsed.data.announcementId, parent_id: caller.userId });

  // 23505 = already acknowledged → treat as success (idempotent).
  if (insErr && insErr.code !== "23505") {
    return NextResponse.json({ error: "Could not record acknowledgement." }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
