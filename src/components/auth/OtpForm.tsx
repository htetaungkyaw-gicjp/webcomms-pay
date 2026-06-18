"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/browser";

/**
 * Verifies the 6-digit OTP. On success the 003 trigger has already run (it fires
 * AFTER INSERT ON auth.users at first verify), so we read the freshly-bound
 * profile and route by role. Fail closed: no profile row OR status='disabled'
 * → sign out and show "no access".
 */
export function OtpForm({ email }: { email: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const supabase = createClient();
    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: "email",
    });

    if (verifyError || !data.user) {
      setError(verifyError?.message ?? "Invalid code.");
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
      setError(
        "No access for this account. Ask your school for an invitation link.",
      );
      setPending(false);
      return;
    }

    if (profile.role === "system_admin") {
      router.push("/admin");
      return;
    }

    // tenant_admin / parent need the tenant slug to build their URL.
    const { data: tenant } = await supabase
      .from("tenants")
      .select("domain_slug")
      .eq("id", profile.tenant_id!)
      .maybeSingle();

    if (!tenant) {
      await supabase.auth.signOut();
      setError("Your tenant could not be resolved. Contact support.");
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
    <form onSubmit={onSubmit} style={{ display: "grid", gap: 12, maxWidth: 360 }}>
      <p>
        Enter the 6-digit code sent to <strong>{email}</strong>.
      </p>
      <input
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={6}
        required
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="123456"
        style={{ padding: 8, border: "1px solid #ccc", borderRadius: 6, fontSize: 20, letterSpacing: 4 }}
      />
      <button type="submit" disabled={pending} style={{ padding: 10 }}>
        {pending ? "Verifying…" : "Verify"}
      </button>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
    </form>
  );
}
