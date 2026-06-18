import Stripe from "stripe";

/**
 * Server-only Stripe client, lazily constructed. Imported ONLY from Route
 * Handlers — never from a Client Component (it carries STRIPE_SECRET_KEY).
 *
 * Lazy init matters: instantiating Stripe at module-eval time throws when
 * STRIPE_SECRET_KEY is empty, which breaks `next build`'s page-data collection
 * (the route module is imported even though it isn't executed). Constructing on
 * first use defers the key requirement to an actual request.
 */
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY is not set.");
    }
    _stripe = new Stripe(key, {
      // Pin the API version for reproducible behaviour (matches stripe@22.2.1).
      apiVersion: "2026-05-27.dahlia",
      typescript: true,
    });
  }
  return _stripe;
}
