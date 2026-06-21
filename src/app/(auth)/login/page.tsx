import { LoginForm } from "@/components/auth/LoginForm";
import { Card, CardTitle } from "@/components/ui/Card";

export default function LoginPage() {
  return (
    <main className="min-h-screen grid place-items-center p-6">
      <Card className="w-full max-w-md" variant="tonal">
        <CardTitle>Sign in</CardTitle>
        <p className="mt-2 mb-6 text-sm text-on-surface-variant">
          Enter your email and we&apos;ll send a one-time code. If you were
          invited, use the link from your invitation email instead.
        </p>
        <LoginForm />
      </Card>
    </main>
  );
}
