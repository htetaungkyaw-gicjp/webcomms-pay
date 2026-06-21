"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";

/**
 * Verifies the 6-digit OTP. On success the 003 trigger has already run (it fires
 * AFTER INSERT ON auth.users at first verify), so we read the freshly-bound
 * profile and route by role. Fail closed: no profile row OR status='disabled'
 * → sign out and show "no access".
 *
 * Brute-force defense: each FAILED verify is reported to /api/auth/otp/verify-
 * guard, which throttles per email+IP. Once the server says `blocked`, the form
 * locks and tells the user to request a fresh code (the only auth factor, so the
 * 1,000,000-key space must not be brute-forceable online — PLAN.md §2).
 */
export function OtpForm({ email }: { email: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [locked, setLocked] = useState(false);

  async function reportFailure(): Promise<boolean> {
    // Returns true if the user is now locked out.
    try {
      const res = await fetch("/api/auth/otp/verify-guard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      return !!data.blocked;
    } catch {
      return false;
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (locked) return;
    setPending(true);

    const supabase = createClient();
    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: "email",
    });

    if (verifyError || !data.user) {
      const nowLocked = await reportFailure();
      if (nowLocked) {
        setLocked(true);
        toast.error("Too many attempts. Request a new code to try again.");
      } else {
        toast.error(verifyError?.message ?? "Invalid code.");
      }
      setPending(false);
      return;
    }

    // Read the profile the trigger bound. RLS lets a user read their own row.
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, status, tenant_id")
      .eq("id", data.user.id)
      .maybeSingle();

    // Fail closed: no invitation matched (no profile) or revoked.
    if (!profile || profile.status === "disabled") {
      await supabase.auth.signOut();
      toast.error("No access for this account. Ask your school for an invite link.");
      setPending(false);
      return;
    }

    if (profile.role === "system_admin") {
      router.push("/admin");
      return;
    }

    const { data: tenant } = await supabase
      .from("tenants")
      .select("domain_slug")
      .eq("id", profile.tenant_id!)
      .maybeSingle();

    if (!tenant) {
      await supabase.auth.signOut();
      toast.error("Your tenant could not be resolved. Contact support.");
      setPending(false);
      return;
    }

    const dest =
      profile.role === "tenant_admin"
        ? `/${tenant.domain_slug}/manage`
        : `/${tenant.domain_slug}/portal`;
    router.push(dest);
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 max-w-sm">
      <p className="text-sm text-on-surface-variant">
        Enter the 6-digit code we sent to <strong>{email}</strong>.
      </p>
      <TextField
        label="One-time code"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={6}
        required
        disabled={locked}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        placeholder="123456"
        className="text-xl tracking-[0.4em]"
        autoComplete="one-time-code"
      />
      <Button type="submit" disabled={pending || locked}>
        {pending ? "Verifying…" : "Verify"}
      </Button>
      {locked && (
        <p className="text-sm text-error">
          Too many attempts.{" "}
          <a href="/login" className="underline">
            Request a new code
          </a>
          .
        </p>
      )}
    </form>
  );
}
