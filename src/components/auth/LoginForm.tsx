"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/browser";

/**
 * Plain OTP-send form. From /login there is NO invite token, so an uninvited
 * email that logs in binds nothing (the 003 trigger finds no invitation) and is
 * shown "ask your school for an invite" on /verify. The invite-carrying path is
 * /accept-invite, which passes options.data.invite_token.
 */
export function LoginForm({
  inviteToken,
  prefillEmail,
}: {
  inviteToken?: string;
  prefillEmail?: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState(prefillEmail ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        // The token is the authorization proof, carried through OTP into the
        // 003 trigger. Absent on a plain /login → binds nothing.
        data: inviteToken ? { invite_token: inviteToken } : undefined,
      },
    });

    if (error) {
      setError(error.message);
      setPending(false);
      return;
    }

    const params = new URLSearchParams({ email });
    if (inviteToken) params.set("token", inviteToken);
    router.push(`/verify?${params.toString()}`);
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: 12, maxWidth: 360 }}>
      <label htmlFor="email">Email</label>
      <input
        id="email"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@school.example"
        style={{ padding: 8, border: "1px solid #ccc", borderRadius: 6 }}
      />
      <button type="submit" disabled={pending} style={{ padding: 10 }}>
        {pending ? "Sending…" : "Send one-time code"}
      </button>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
    </form>
  );
}
