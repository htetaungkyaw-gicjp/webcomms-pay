import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Upstash rate limiters for abuse + cost control on the OTP flow (PLAN.md §2).
 *
 * OTP is the ONLY auth factor, so two surfaces are throttled:
 *   * SEND  — per-email and per-IP, to stop send-spam / Resend cost abuse.
 *   * VERIFY — failed 6-digit attempts (1,000,000-key space): an attacker who
 *     triggers one send could otherwise brute-force the code online.
 *
 * Server-only — never import from a Client Component (carries the Upstash token).
 *
 * Fail-OPEN vs fail-CLOSED: if Upstash isn't configured (env missing) we return
 * a no-op limiter that ALLOWS — so local dev without Upstash still works. In
 * production the env vars MUST be set; a missing-config warning is logged once.
 */

let _redis: Redis | null = null;
let warned = false;

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    if (!warned) {
      console.warn(
        "[ratelimit] UPSTASH_REDIS_REST_URL/TOKEN not set — rate limiting DISABLED (fail-open). Set these in production.",
      );
      warned = true;
    }
    return null;
  }
  if (!_redis) _redis = new Redis({ url, token });
  return _redis;
}

/** Result of a limit check. `success=true` means the action is allowed. */
export type LimitResult = { success: boolean; remaining: number; reset: number };

const ALLOW: LimitResult = { success: true, remaining: 999, reset: 0 };

function makeLimiter(limiter: ReturnType<typeof Ratelimit.slidingWindow>, prefix: string) {
  let instance: Ratelimit | null = null;
  return async (key: string): Promise<LimitResult> => {
    const redis = getRedis();
    if (!redis) return ALLOW; // fail-open when unconfigured (dev)
    if (!instance) {
      instance = new Ratelimit({ redis, limiter, prefix, analytics: false });
    }
    const { success, remaining, reset } = await instance.limit(key);
    return { success, remaining, reset };
  };
}

// OTP send: 5/hour/email, 20/hour/IP (PLAN.md §2).
export const otpSendByEmail = makeLimiter(Ratelimit.slidingWindow(5, "1 h"), "otp_send_email");
export const otpSendByIp = makeLimiter(Ratelimit.slidingWindow(20, "1 h"), "otp_send_ip");

// OTP verify failures: 5 failed attempts / 15 min / (email+IP), then forced backoff.
export const otpVerifyFailures = makeLimiter(Ratelimit.slidingWindow(5, "15 m"), "otp_verify_fail");

// Per-action limits on expensive/abusable endpoints (PLAN.md §5 checklist).
export const checkoutByUser = makeLimiter(Ratelimit.slidingWindow(10, "10 m"), "checkout_user");
export const bookingByUser = makeLimiter(Ratelimit.slidingWindow(20, "10 m"), "booking_user");

/** Best-effort client IP from forwarded headers (Netlify/Vercel set these). */
export function clientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return headers.get("x-real-ip") ?? "0.0.0.0";
}
