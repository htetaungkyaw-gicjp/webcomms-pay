import Link from "next/link";
import { Card } from "@/components/ui/Card";

export default async function PaymentCancelledPage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string }>;
}) {
  const { slug } = await searchParams;
  const portalHref = slug ? `/${slug}/portal` : "/";

  return (
    <main className="hero-wash min-h-screen grid place-items-center p-6">
      <Card variant="tonal" className="rise-in w-full max-w-md text-center">
        <div className="mx-auto grid size-14 place-items-center rounded-full bg-surface-variant text-2xl text-on-surface-variant">
          ↺
        </div>
        <h1 className="mt-4 font-display text-2xl font-medium text-on-surface">
          Payment cancelled
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-on-surface-variant">
          No charge was made. You can head back to the portal and try again
          whenever you&apos;re ready.
        </p>
        <Link
          href={portalHref}
          className="mt-6 inline-flex h-10 items-center justify-center rounded-full bg-primary px-6 font-display text-sm font-medium text-on-primary transition-[filter] hover:brightness-110 active:brightness-95"
        >
          Return and try again
        </Link>
      </Card>
    </main>
  );
}
