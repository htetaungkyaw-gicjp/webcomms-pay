import Link from "next/link";

export default function Home() {
  return (
    <main style={{ padding: 32 }}>
      <h1>WebComms &amp; Pay</h1>
      <p style={{ color: "#555", maxWidth: 480 }}>
        Passwordless parent-communication and payments for schools, gyms, and
        clubs. This is the Phase 0 walking skeleton.
      </p>
      <p>
        <Link href="/login">Sign in →</Link>
      </p>
    </main>
  );
}
