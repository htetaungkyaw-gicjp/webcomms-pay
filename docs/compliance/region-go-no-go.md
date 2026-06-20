# Region / Scope Go-No-Go ⚠️ OPEN

**Status:** **UNRESOLVED — this is a gate before any real tester PII lands in prod.**

## The problem
The Supabase region is a **one-way door** (cannot be changed after project
creation). The dev/stg project was created in **Asia Pacific**, *not* the UK/EU
region the original plan assumed. PLAN.md's entire compliance framing (UK/EU GDPR,
UK Children's Code, HMRC retention windows) was written for UK/EU data residency
that does **not** match the deployed region.

## The decision (pick one before prod)
- **(a) Re-create prod in a UK/EU region** and keep the GDPR framing as written.
- **(b) Commit to AP residency** and redo the lawful-basis / cross-border-transfer /
  applicable-law analysis for the actual target market.

## Current state
- dev/stg in AP is **acceptable for test data**.
- The **prod region decision is the gate** — until decided, treat all
  GDPR-specific clauses across these docs as *provisional*.

## Owner / deadline
- [ ] Owner: _TBD_
- [ ] Decide before: first external tester with real PII.
