/** Format integer minor units (cents) as a currency string. */
export function formatMoney(amountCents: number, currency: string): string {
  return new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amountCents / 100);
}
