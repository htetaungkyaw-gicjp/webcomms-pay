---
marp: true
theme: default
paginate: true
size: 16:9
# PechaKucha format: 6 slides × 20 seconds = 2 minutes, auto-advance.
# Render to a self-advancing HTML deck with:
#   npx @marp-team/marp-cli@latest slides/webcomms-pay-pechakucha.md \
#     --html --bespoke.transition --o webcomms-pay-pechakucha.html
# Auto-advance is driven by the meta-refresh per slide below (20s each).
style: |
  section {
    font-family: -apple-system, Segoe UI, Roboto, sans-serif;
    font-size: 30px;
  }
  h1 { color: #1d4ed8; }
  .big { font-size: 1.6em; font-weight: 700; }
  .muted { color: #64748b; }
---

<!-- _class: lead -->
<!-- advance: 20s -->

# WebComms & Pay

## Pay, plan, and stay informed — all in one place.

<span class="muted">One simple app for schools, gyms & clubs — and each organisation's data is completely walled off from every other.</span>

<!--
Speaker (~20s): WebComms & Pay is the all-in-one parent communication and payment
platform for schools, gyms and clubs. Parents log in with just their email — no
passwords — to pay fees, see the calendar, book meetings and read notices.
-->

---

<!-- advance: 20s -->

# The problem

Schools juggle a **messy stack** of disconnected tools:

- 💸 Payments chased by bank transfer, cash, spreadsheets
- 📢 Announcements lost in email blasts & group chats
- 📞 Meetings booked by phone tag
- 📅 Calendars buried in PDFs nobody opens

<span class="muted">Late payments, missed notices, admins drowning in admin.</span>

<!--
Speaker (~20s): Today schools live with a messy stack — payments chased through
bank transfers and spreadsheets, announcements lost in email, meetings booked by
phone tag, calendars in PDFs. The result is late payments, missed notices, and
administrators drowning in busywork.
-->

---

<!-- advance: 20s -->

# The solution

## One passwordless portal. Four jobs done.

| Pay | Plan | Book | Read |
|---|---|---|---|
| Stripe checkout | School calendar | Parent–teacher slots | Announcements |

<span class="muted">Parents enter their email, get a one-time code, and they're in.</span>

<!--
Speaker (~20s): WebComms & Pay replaces that stack with one clean platform. Parents
pay tuition through Stripe, browse the school calendar, book parent-teacher meetings,
and read announcements — all in a single passwordless portal. Lower friction, fewer
support tickets, better security.
-->

---

<!-- advance: 20s -->

# Trust is a feature

We handle **children's data** — privacy is built in, not bolted on:

- 🔒 **Tenant isolation** enforced at the database layer
- 💳 **Stripe** — we never store card numbers
- 🧾 **Audit trail** — "who saw my child's record?"
- 📜 Built around **UK/EU GDPR + the Children's Code**

<!--
Speaker (~20s): Because we handle children's data, privacy is a selling point, not
fine print. One school can never see another's data — it's enforced at the database
level. Payments run through Stripe, we never store card numbers, and an audit trail
answers the school's question: who accessed my child's record?
-->

---

<!-- advance: 20s -->

# How it works

1. The school **invites** a parent by email
2. The parent enters the **one-time code**
3. They land in their school's **private portal**, linked to their child
4. They **pay, plan, book, and read** — in one place
5. The admin sees payments update **in real time**

<span class="muted">No passwords. No app-store download. No data shared between schools.</span>

<!--
Speaker (~20s): The journey is simple. The school invites a parent by email; the
parent enters the one-time code and lands in their school's private portal, already
linked to their child. They pay fees, check the calendar, book a meeting and read
notices — while the admin watches payments update in real time.
-->

---

<!-- _class: lead -->
<!-- advance: 20s -->

# Roadmap & the ask

**Now:** secure onboarding · payments · announcements
**Next:** calendar · admin tools · meeting booking
**Later:** refunds · richer email · more regions

## <span class="big">Invite a pilot school. Book a demo.</span>

<span class="muted">Built for families. Trusted by schools.</span>

<!--
Speaker (~20s): We're building must-have features first — secure onboarding, payments
and announcements — with the calendar, fuller admin tools and meeting scheduling next.
The ask is simple: invite a pilot school and book a demo. Built for families, trusted
by schools.
-->
