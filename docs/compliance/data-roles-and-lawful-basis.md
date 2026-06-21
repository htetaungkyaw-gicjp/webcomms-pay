# Data Roles & Lawful Basis

**Status:** Skeleton (Phase 1 decision; finalise in Phase 5). Provisional pending
the [region go/no-go](region-go-no-go.md).

## Roles

| Party | Role | Notes |
|---|---|---|
| Tenant (school / gym / club) | **Data Controller** | Decides purposes & means for the child/parent data it uploads. |
| WebComms & Pay (the platform) | **Data Processor** | Acts only on documented instructions from the Controller. |
| Stripe | Processor (payments) | Separate controller for some fraud/AML purposes — see sub-processor register. |
| Supabase, Resend, Upstash, Netlify | Sub-processors | Flow-down obligations via the DPA. |

## Lawful basis

- Platform↔school relationship: **performance of the contract** with the school
  (GDPR Art. 6(1)(b)) for operating the service.
- Child personal data: the **school's own lawful basis** (typically public task /
  legitimate interests / consent depending on the school type and jurisdiction).
  The platform processes it solely under the school's instructions.
- Payments: **legal obligation** (financial-record retention) + contract.

## Why this matters / cannot be retrofitted

The controller/processor split determines: who answers data-subject requests, who
signs the DPA with whom, breach-notification direction (processor → controller
clocks under Art. 33), and the retention/erasure split (see
[retention-schedule.md](retention-schedule.md)).

## Open items

- [ ] Confirm against the **actual deployment region** (AP vs UK/EU) — the basis
      analysis differs by applicable law. Blocked on the region go/no-go.
- [ ] Per-tenant Controller contact recorded at onboarding.
