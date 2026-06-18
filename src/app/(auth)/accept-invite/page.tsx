import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/LoginForm";

/**
 * Invitation acceptance entry. Reads token + email from the URL and seeds the
 * OTP send with the invite token so the 003 trigger can verify token+email on
 * the same invitation row. The email is prefilled but the user still proves
 * inbox possession via OTP — token AND inbox are both required.
 */
export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; email?: string }>;
}) {
  const { token, email } = await searchParams;
  if (!token || !email) redirect("/login");

  return (
    <main style={{ padding: 32 }}>
      <h1>Accept your invitation</h1>
      <p style={{ color: "#555", maxWidth: 420 }}>
        You were invited as <strong>{email}</strong>. Confirm your email to
        receive a one-time code.
      </p>
      <LoginForm inviteToken={token} prefillEmail={email} />
    </main>
  );
}
