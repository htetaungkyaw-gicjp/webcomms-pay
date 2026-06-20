import { NextResponse } from "next/server";

import { otpVerifyFailures, clientIp } from "@/lib/ratelimit";

/**
 * OTP verify throttle (PLAN.md §2). A 6-digit code is a 1,000,000-key space and
 * OTP is the only auth factor, so failed verify attempts must be throttled or an
 * attacker who triggers one send could brute-force the code online.
 *
 * The browser performs verifyOtp itself (the pure code flow returns the session
 * in-page). This route records a FAILED attempt and reports whether the
 * email+IP is now locked out. The client calls it after each failed verifyOtp;
 * once `blocked` is true it must stop accepting attempts and force a fresh send.
 *
 * Keyed on email+IP, sliding window (5 failures / 15 min — see lib/ratelimit).
 */
export async function POST(request: Request) {
  let body: { email?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const key = `${email}:${clientIp(request.headers)}`;
  const res = await otpVerifyFailures(key);
  // res.success === false → this failure pushed the key over the limit.
  return NextResponse.json({ blocked: !res.success, remaining: res.remaining });
}
