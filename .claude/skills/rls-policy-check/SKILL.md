---
name: rls-policy-check
description: Audit a Supabase migration or RLS policy file for WebComms & Pay's tenant-isolation invariants. Use when reviewing, writing, or editing SQL under supabase/migrations/, or when the user mentions RLS, row-level security, tenant isolation, helper functions, or policies.
allowed-tools: Read, Grep, Glob
---

# RLS Policy Check

You are auditing Supabase SQL for **WebComms & Pay**, a multi-tenant platform handling
minors' PII and payments. A single RLS mistake leaks one school's children/payments to
another tenant. Check the target file(s) against the invariants below and report a
**pass/fail list with `file:line` for every violation**. Do not edit — report only.

## How to run

1. Determine the target: the file the user named, the current diff, or all of
   `supabase/migrations/*.sql` (use Glob/Grep to find them).
2. Read the SQL and check each invariant below.
3. Output a checklist: ✅ pass / ❌ fail (with `file:line` + the offending snippet) /
   ⚠️ can't-tell. End with an overall PASS/FAIL.

## Invariants (from the implementation plan, §001–003)

1. **RLS enabled on every table.** Each table in `001_initial_schema.sql` must have a
   matching `ALTER TABLE <t> ENABLE ROW LEVEL SECURITY;`. Flag any table with no policies.

2. **`system_admin` short-circuit first.** Every tenant-scoped policy must begin with
   `(SELECT private.current_role()) = 'system_admin' OR ...`. A `system_admin` has
   `tenant_id = NULL`; without the leading OR they are locked out of everything.

3. **Helpers live in the `private` schema** — never `auth` (reserved) or `public`
   (API-exposed). Each helper must be `SECURITY DEFINER` **and** `SET search_path = ''`
   with all references fully-qualified (`public.profiles`, not `profiles`). A missing
   `search_path = ''` is a privilege-escalation hole — flag it.

4. **Helper calls wrapped in a subselect** — `(SELECT private.current_role())`, not a bare
   `private.current_role()`. Bare calls re-evaluate per row (perf) — flag as ⚠️.

5. **`invitations_write` keeps the escape in BOTH `USING` and `WITH CHECK`.** WITH CHECK
   must allow `system_admin` any insert, and restrict `tenant_admin` to their own
   `tenant_id` **and** `role <> 'system_admin'`. A tenant_admin able to mint a
   `system_admin` invite is privilege escalation — flag it.

6. **Append-only tables.** `audit_log` and `announcement_acknowledgements` must have an
   INSERT policy and **no** UPDATE/DELETE policy (and `audit_log` must not be in any
   cascade-delete path). Flag any UPDATE/DELETE policy on these.

7. **Double-booking guard.** `appointments.status` must be `NOT NULL DEFAULT 'pending'`,
   and the partial unique index must be
   `ON appointments (slot_id) WHERE status != 'cancelled'`. There must be **no `is_booked`
   column** (it's a desyncable duplicate). Flag a NULLable status or an `is_booked` flag.

8. **`processed_stripe_events` has no policies** (only the service-role webhook touches it).

## Output format

```
RLS Policy Check — <file(s)>
✅ RLS enabled on all tables
❌ system_admin short-circuit missing — supabase/migrations/002_rls_policies.sql:88 (events_select)
⚠️ bare helper call (per-row) — 002_rls_policies.sql:140
...
OVERALL: FAIL (2 issues)
```
