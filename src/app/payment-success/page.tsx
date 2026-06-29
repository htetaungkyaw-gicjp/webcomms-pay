import Link from "next/link";
import { Card } from "@/components/ui/Card";

export default async function PaymentSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string }>;
}) {
  const { slug } = await searchParams;
  const portalHref = slug ? `/${slug}/portal` : "/";

  return (
    <main className="hero-wash min-h-screen grid place-items-center p-6">
      <Card variant="tonal" className="rise-in w-full max-w-md text-center">
        <div className="mx-auto grid size-14 place-items-center rounded-full bg-success-container text-2xl">
          ✅
        </div>
        <h1 className="mt-4 font-display text-2xl font-medium text-on-surface">
          Payment received
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-on-surface-variant">
          Thanks — your payment is being confirmed. Your invoice updates to{" "}
          <span className="font-medium text-on-surface">Paid</span> as soon as
          Stripe notifies us, usually within a few seconds.
        </p>
        <Link
          href={portalHref}
          className="mt-6 inline-flex h-10 items-center justify-center rounded-full bg-primary px-6 font-display text-sm font-medium text-on-primary transition-[filter] hover:brightness-110 active:brightness-95"
        >
          Back to portal
        </Link>
      </Card>
    </main>
  );
}
