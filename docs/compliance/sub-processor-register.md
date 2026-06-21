# Sub-processor Register

**Status:** Skeleton. Each sub-processor must have a confirmed DPA and a recorded
processing region. Provisional pending the [region go/no-go](region-go-no-go.md).

| Sub-processor | Purpose | Data processed | Region | DPA confirmed |
|---|---|---|---|---|
| Supabase | Database + Auth (OTP) | All PII at rest, email | **Asia Pacific** (dev/stg; prod TBD) | [ ] |
| Stripe | Payments | Payment data, email | (per Stripe account region) | [ ] |
| Resend | Transactional + OTP email | Email address | (US/EU per config) | [ ] |
| Upstash | Rate-limit state | Hashed email / IP | (per Upstash region) | [ ] |
| Netlify | Hosting / edge | In-transit request data | (CDN; global) | [ ] |

## Open items
- [ ] Confirm each upstream DPA and processing region.
- [ ] Cross-border transfer mechanism per the region decision (SCCs / adequacy).
- [ ] Change-notification process to tenants when a sub-processor changes.
