# Data Processing Agreement (Art. 28) — Customer-facing Template

**Status:** Skeleton. A signed DPA with each tenant is a **hard prerequisite to
onboarding the first paying school**. Provisional pending the
[region go/no-go](region-go-no-go.md). This is **not legal advice** — have counsel
review before use.

## Parties
- **Controller:** the Tenant (school / gym / club).
- **Processor:** WebComms & Pay.

## Required clauses (Art. 28(3))
1. **Subject-matter, duration, nature & purpose** of processing; types of personal
   data; categories of data subjects (children, parents, staff).
2. **Process only on documented instructions** from the Controller.
3. **Confidentiality** of persons authorised to process.
4. **Security measures** (Art. 32): RLS tenant isolation, encryption in transit,
   OTP-only auth, audit logging, secret-scanning, least-privilege.
5. **Sub-processors:** general authorisation with the register
   ([sub-processor-register.md](sub-processor-register.md)) + flow-down + change notice.
6. **Assistance** with data-subject requests (DSAR/erasure endpoints) and with
   Art. 32–36 obligations.
7. **Breach notification** to the Controller without undue delay (clocks for
   Art. 33/34).
8. **Deletion or return** of personal data on termination, subject to the
   financial-retention carve-out ([retention-schedule.md](retention-schedule.md)).
9. **Audit & inspection** rights.

## Open items
- [ ] Counsel review.
- [ ] Region/transfer mechanism (SCCs?) once region is decided.
- [ ] Signature workflow at tenant onboarding.
