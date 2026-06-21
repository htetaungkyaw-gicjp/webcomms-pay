import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/LoginForm";
import { Card, CardTitle } from "@/components/ui/Card";

/**
 * Invitation acceptance entry. Reads token + email from the URL and seeds the
 * OTP send with the invite token so the 003 trigger can verify token+email on
 * the same invitation row. The email is prefilled but the user still proves
 * inbox possession via OTP — the invite link PLUS your inbox together prove it's
 * you (DESIGN.md tone).
 */
export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; email?: string }>;
}) {
  const { token, email } = await searchParams;
  if (!token || !email) redirect("/login");

  return (
    <main className="min-h-screen grid place-items-center p-6">
      <Card className="w-full max-w-md" variant="tonal">
        <CardTitle>Accept your invitation</CardTitle>
        <p className="mt-2 mb-6 text-sm text-on-surface-variant">
          You were invited as <strong>{email}</strong>. Confirm your email to
          receive a one-time code — the invite link plus your inbox together
          prove it&apos;s you.
        </p>
        <LoginForm inviteToken={token} prefillEmail={email} />
      </Card>
    </main>
  );
}
