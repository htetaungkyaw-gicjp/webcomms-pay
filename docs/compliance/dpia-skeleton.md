# DPIA Skeleton

**Status:** Skeleton (living doc; finalise in Phase 5). Large-scale processing of
children's data is a near-automatic DPIA trigger. Provisional pending the
[region go/no-go](region-go-no-go.md).

## 1. Processing overview
Multi-tenant SaaS: parents log in (Email OTP) to view/pay tuition, read
announcements, view a calendar, and book parent-teacher meetings.

## 2. Data flows
- Parent/admin → app (Next.js on Netlify) → Supabase (Postgres, Auth) — PII at rest.
- App → Stripe — payment data (server-authoritative amounts; no card data touches us).
- App → Resend — invitation + OTP email (email address only).
- App → Upstash — rate-limit keys (hashed email/IP).

## 3. Data subjects & categories
- **Children:** name, class. (No special-category data collected by design.)
- **Parents:** name, email, payment history.
- **Staff (tenant_admin):** name, email.

## 4. Necessity & proportionality
Minimal fields; no card data stored (Stripe-hosted Checkout); OTP-only auth (no
passwords to leak).

## 5. Risks & mitigations
| Risk | Mitigation |
|---|---|
| Cross-tenant data leakage | Postgres RLS as the true boundary + layout guard (defense-in-depth) |
| Public-repo secret exposure | gitleaks CI + Push Protection + `${VAR}` expansion + rotation policy |
| OTP account takeover (brute force) | Verify-attempt throttling + short OTP expiry + send rate limits |
| Stored XSS via announcements | Escaped render + strict CSP backstop |
| IDOR on admin-client routes | Mandatory re-auth + resource authorization in code |

## 6. Open items
- [ ] Finalise applicable law from the region decision.
- [ ] DPO / contact details.
- [ ] Sign-off.
