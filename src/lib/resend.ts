import { Resend } from "resend";

/**
 * Server-only transactional email via Resend (PLAN.md §1-E). Used to send the
 * invitation email carrying the /accept-invite token link. OTP emails are sent
 * by Supabase Auth's own SMTP (also Resend) — this client is for OUR mails.
 *
 * Lazily constructed so `next build` page-data collection doesn't throw when
 * RESEND_API_KEY is empty (mirrors lib/stripe.ts). Never import from a Client
 * Component — it carries RESEND_API_KEY.
 */
let _resend: Resend | null = null;

function getResend(): Resend {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error("RESEND_API_KEY is not set.");
    _resend = new Resend(key);
  }
  return _resend;
}

const FROM = process.env.RESEND_FROM_EMAIL ?? "WebComms & Pay <onboarding@resend.dev>";

/** Escape user/tenant-supplied text before interpolating into the HTML email. */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendInvitationEmail(opts: {
  to: string;
  acceptUrl: string;
  tenantName: string;
  role: string;
}) {
  const { to, acceptUrl, tenantName, role } = opts;
  const roleLabel = role === "tenant_admin" ? "an administrator" : "a parent";
  const subject = `You're invited to ${tenantName} on WebComms & Pay`;
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="margin:0 0 12px">You've been invited</h2>
      <p>You've been invited to join <strong>${esc(tenantName)}</strong> as ${esc(roleLabel)}.</p>
      <p>Click below to accept. You'll receive a one-time code by email to confirm it's you.</p>
      <p style="margin:24px 0">
        <a href="${esc(acceptUrl)}"
           style="background:#0f172a;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">
          Accept invitation
        </a>
      </p>
      <p style="color:#64748b;font-size:13px">This link is unique to you — don't forward it. It expires soon.</p>
    </div>`;
  const text = `You've been invited to join ${tenantName} as ${roleLabel}.\n\nAccept your invitation: ${acceptUrl}\n\nThis link is unique to you and expires soon.`;

  return getResend().emails.send({ from: FROM, to, subject, html, text });
}
