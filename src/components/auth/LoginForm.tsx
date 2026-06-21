"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";

/**
 * OTP-send form. Calls the server route /api/auth/otp/send, which enforces the
 * per-email + per-IP send rate limit BEFORE asking Supabase to email a code (the
 * client can't be trusted to self-limit). From /login there is no invite token,
 * so an uninvited email binds nothing (the 003 trigger finds no invitation) and
 * is shown "ask your school for an invite" on /verify. The invite-carrying path
 * is /accept-invite, which passes the token through.
 *
 * Copy is end-user framed (DESIGN.md tone): "Email me a code".
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
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);

    const res = await fetch("/api/auth/otp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, inviteToken }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "Couldn't send a code. Try again.");
      setPending(false);
      return;
    }

    // Navigate to the OTP entry screen. router.push targets /verify, an async
    // Server Component; on some deployed Turbopack builds the client RSC
    // navigation can silently no-op even though this handler ran (the email was
    // sent). Fall back to a hard navigation so the user is never stranded on
    // /login after a successful send.
    const params = new URLSearchParams({ email });
    if (inviteToken) params.set("token", inviteToken);
    const target = `/verify?${params.toString()}`;
    router.push(target);
    // If the soft navigation hasn't changed the URL shortly, force it.
    window.setTimeout(() => {
      if (window.location.pathname === "/login") {
        window.location.assign(target);
      }
    }, 150);
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 max-w-sm">
      <TextField
        label="Email"
        type="email"
        required
        value={email}
        readOnly={!!prefillEmail}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@school.example"
        autoComplete="email"
      />
      <Button type="submit" disabled={pending}>
        {pending ? "Sending…" : "Email me a code"}
      </Button>
    </form>
  );
}
