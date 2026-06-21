import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Tailwind-aware className combiner (shadcn convention). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Format integer minor units (cents) as a currency string. */
export function formatMoney(amountCents: number, currency: string): string {
  return new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amountCents / 100);
}

/** Format an ISO timestamp in a tenant's IANA timezone (defaults to local). */
export function formatDateTime(iso: string, timeZone?: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    ...(timeZone ? { timeZone } : {}),
  }).format(new Date(iso));
}
