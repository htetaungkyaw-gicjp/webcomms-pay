import Link from "next/link";

export default function Home() {
  return (
    <main className="hero-wash min-h-screen grid place-items-center p-6">
      <div className="rise-in w-full max-w-2xl text-center">
        <span className="inline-flex items-center rounded-full bg-primary-container px-4 py-1.5 text-xs font-medium text-on-primary-container">
          Parent communication &amp; payments
        </span>

        <h1 className="mt-6 font-display text-4xl font-medium tracking-tight text-on-surface sm:text-5xl">
          WebComms <span className="text-primary">&amp;</span> Pay
        </h1>

        <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-on-surface-variant">
          Passwordless parent-communication and payments for schools, gyms, and
          clubs — invoices, calendar, parent-teacher booking, and announcements,
          all in one calm place.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/login"
            className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-7 font-display text-sm font-medium text-on-primary transition-[filter] hover:brightness-110 active:brightness-95"
          >
            Sign in
          </Link>
          <span className="text-xs text-on-surface-variant">
            Invited? Use the link from your email.
          </span>
        </div>
      </div>
    </main>
  );
}
