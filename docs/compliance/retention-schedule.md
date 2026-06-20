# Retention Schedule (per table)

**Status:** Skeleton. The erasure-vs-retention SPLIT is already enforced in the
schema (PLAN.md §1-G) — this document records the policy the cleanup job will
implement. Provisional pending the [region go/no-go](region-go-no-go.md) (the
financial-retention window is jurisdiction-specific).

## The split (schema-enforced)

- **Erasable / cascade-deletable (PII, educational data):** `profiles`,
  `students`, `events`, `announcements`, `announcement_acknowledgements`,
  `appointments`, `appointment_slots`, `teachers`. These cascade on
  tenant/parent erasure.
- **Retained, NOT cascade-deleted (financial):** `invoices` / payment references.
  On parent/student erasure the person link is set NULL (`students.id` →
  `invoices.student_id ON DELETE SET NULL`) and the row is **pseudonymised** —
  amount/date/currency/tax fields retained for the statutory window.
- **Append-only, survives erasure:** `audit_log` (tenant_id `ON DELETE SET NULL`,
  no actor FK) — accountability trail must outlive the actor.

## Schedule

| Data class | Tables | Retention | Action at expiry |
|---|---|---|---|
| Financial records | `invoices` | **6–7 yrs** (statutory; confirm per region) | Purge |
| PII / educational | `profiles`, `students`, etc. | Until account closure or per Controller instruction | Cascade delete |
| Invitations | `invitations` | Expiry + short grace | Purge |
| Audit log | `audit_log` | Per policy (e.g. 2 yrs) | Purge |
| Webhook idempotency | `processed_stripe_events` | 90 days | Purge |

## Open items

- [ ] Implement the **scheduled cleanup job** (Supabase scheduled function / cron).
- [ ] Implement the **erasure routine** (pseudonymise invoices, cascade PII) and a
      test that erasing a parent removes PII but retains pseudonymised invoices.
- [ ] Confirm the financial-retention window for the chosen region/jurisdiction.
