---
marp: true
paginate: true
transition: fade
# PechaKucha: 6 slides, 20s auto-advance. Do not change the count.
auto-advance: 20
---

<!-- slide 1 -->
# Who's my person?
<!-- 20s -->

A school administrator drowning in admin: chasing tuition by bank transfer, posting
notices nobody reads, booking parent meetings by phone. **WebComms & Pay** is for them
and the parents they serve.

---

<!-- slide 2 -->
# Their problem

Schools juggle a **messy stack**: payments in spreadsheets, announcements lost in email,
meetings booked by phone tag, calendars buried in PDFs. The result — late payments,
missed notices, and no single trusted place for parents.

---

<!-- slide 3 -->
# What I built

A **multi-tenant, passwordless** parent portal: log in with an email one-time code, pay
fees via Stripe, browse the school calendar, book a parent-teacher slot, and read
announcements — with every school's data **isolated at the database layer**.

---

<!-- slide 4 -->
# How I built it
- **MCP:** Supabase (read-only) for DB/RLS introspection + GitHub — `.mcp.json`, secrets via `${...}`
- **Skill:** `rls-policy-check` — audits migrations for tenant-isolation invariants
- **Agent:** `secret-leak-auditor` — scans for committed secrets before going public

---

<!-- slide 5 -->
# Why it matters

We handle **children's data**, so trust is the product: cross-tenant isolation, Stripe (no
stored cards), an append-only audit trail answering "who saw my child's record?", and
GDPR/Children's-Code design from day one. Privacy is a feature, not fine print.

---

<!-- slide 6 -->
# Done checklist
- [x] repo public
- [x] MCP + skill + agent used
- [x] report.md in team repo
