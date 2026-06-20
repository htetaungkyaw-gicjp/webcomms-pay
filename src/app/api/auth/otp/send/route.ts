import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { otpSendByEmail, otpSendByIp, clientIp } from "@/lib/ratelimit";

/**
 * Rate-limited OTP send (PLAN.md §2 "Rate limiting"). OTP is the ONLY auth
 * factor, so the send path is throttled per-email AND per-IP before we ask
 * Supabase to email a code. The session is NOT created here — signInWithOtp only
 * sends the email; the session lands in the browser at verifyOtp. So sending
 * server-side is safe and lets us enforce the limit server-side (the client
 * can't be trusted to self-limit).
 *
 * Body: { email, inviteToken?, fullName? }. The inviteToken is carried into
 * user_metadata so the 003 trigger can verify token+email on first verify.
 */
export async function POST(request: Request) {
  let body: { email?: unknown; inviteToken?: unknown; fullName?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const inviteToken = typeof body.inviteToken === "string" ? body.inviteToken : undefined;
  const fullName = typeof body.fullName === "string" ? body.fullName.slice(0, 200) : undefined;

  // Basic shape check (real validation is Supabase's; this rejects obvious junk).
  if (!email || !email.includes("@") || email.length > 320) {
    return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  }

  // Rate limit: per-email then per-IP. 429 with a friendly message if exceeded.
  const ip = clientIp(request.headers);
  const [byEmail, byIp] = await Promise.all([
    otpSendByEmail(email),
    otpSendByIp(ip),
  ]);
  if (!byEmail.success || !byIp.success) {
    return NextResponse.json(
      { error: "Too many code requests. Please wait a while and try again." },
      { status: 429 },
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      data: {
        ...(inviteToken ? { invite_token: inviteToken } : {}),
        ...(fullName ? { full_name: fullName } : {}),
      },
    },
  });

  if (error) {
    // Don't leak whether the email exists; surface Supabase's generic message.
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
