import { redirect } from "next/navigation";

import { OtpForm } from "@/components/auth/OtpForm";

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;
  if (!email) redirect("/login");

  return (
    <main style={{ padding: 32 }}>
      <h1>Enter your code</h1>
      <OtpForm email={email} />
    </main>
  );
}
