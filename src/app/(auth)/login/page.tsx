import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <main style={{ padding: 32 }}>
      <h1>Sign in</h1>
      <p style={{ color: "#555", maxWidth: 420 }}>
        Enter your email and we&apos;ll send a one-time code. If you were invited,
        use the link from your invitation email instead.
      </p>
      <LoginForm />
    </main>
  );
}
