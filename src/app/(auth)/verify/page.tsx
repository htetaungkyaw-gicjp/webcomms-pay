import { redirect } from "next/navigation";

import { OtpForm } from "@/components/auth/OtpForm";
import { Card, CardTitle } from "@/components/ui/Card";

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;
  if (!email) redirect("/login");

  return (
    <main className="min-h-screen grid place-items-center p-6">
      <Card className="w-full max-w-md" variant="tonal">
        <CardTitle>Enter your code</CardTitle>
        <div className="mt-4">
          <OtpForm email={email} />
        </div>
      </Card>
    </main>
  );
}
