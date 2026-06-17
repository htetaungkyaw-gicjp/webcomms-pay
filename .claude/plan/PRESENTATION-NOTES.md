# WebComms & Pay — Marketing Presentation Notes

> **Source notes for NotebookLM.** These notes are written in plain, narrative language so NotebookLM can generate a presentation, audio overview, or briefing doc. They translate a technical engineering plan into a marketing story. Numbers and dates reflect the current plan as of mid-2026.

---

## 1. The One-Line Pitch

**WebComms & Pay is the all-in-one parent communication and payment platform for schools, gyms, and clubs.** Parents log in with just their email — no passwords to forget — to pay tuition, view calendars, book meetings, and read announcements. Every organisation gets its own secure, private space.

**Elevator version:** "One simple app where parents pay, plan, and stay informed — and where each school's data is completely walled off from every other."

---

## 2. The Problem We Solve

Schools, gyms, and clubs today juggle a messy stack of disconnected tools:

- **Payments** chased through bank transfers, cash envelopes, and spreadsheets.
- **Communication** scattered across email blasts, paper notes, and group chats parents miss.
- **Scheduling** parent-teacher meetings via back-and-forth phone calls.
- **Calendars** that live in PDFs nobody opens.

The result: late payments, missed announcements, frustrated parents, and administrators drowning in admin work. Small organisations can't afford enterprise software, and generic tools aren't built for the parent-child-organisation relationship.

**WebComms & Pay replaces that stack with one clean platform built specifically for parent-facing organisations.**

---

## 3. Who It's For

| Audience | What they get |
|---|---|
| **Parents** | A single, password-free portal to pay fees, see the calendar, book meetings, and read notices. |
| **School / club admins** | Tools to invoice families, post announcements, manage teachers and students, and set meeting slots. |
| **Platform operators** | A multi-tenant system that onboards new organisations cleanly and keeps each one isolated. |

**Primary launch market:** Schools, gyms, and clubs in the **UK and EU**.

---

## 4. Key Features (the marketing highlights)

### Passwordless Login (Email OTP)
Parents never create or remember a password. They enter their email, receive a one-time code, and they're in. **Lower friction, fewer support tickets, better security.**

### Simple, Reliable Payments
Parents pay tuition and fees in a few taps through **Stripe** — the same trusted checkout used by millions of businesses. Pay one invoice or pay them all at once. Admins see what's paid in real time.

### School Calendar
A clean, color-coded calendar of events parents can actually browse — term dates, events, closures — right inside the portal.

### Parent-Teacher Meeting Booking
Parents see their child's teacher's available slots and book instantly. No phone tag, no double-bookings — the system guarantees one slot, one booking.

### Announcements & Notices
Admins post announcements; parents read and acknowledge them. A clear record of who's been informed.

### Multi-Tenant by Design
Every organisation gets its own private space under its own web address. **One school can never see another school's data** — this isolation is enforced at the database level, not just hidden in the app.

---

## 5. Why It's Trustworthy — Security & Privacy as a Selling Point

This is a differentiator, not just a checkbox. We handle **children's personal data**, so we built privacy and security in from day one — not bolted on later.

Talking points for the deck:

- **Bank-grade payment security.** Payments run through Stripe; we never store card numbers.
- **Complete data isolation between organisations.** Enforced at the database layer so a leak between tenants is structurally prevented.
- **Built for children's data compliance.** Designed around UK/EU GDPR and the UK Children's Code from the start — including data-protection agreements (DPAs) for every school, a privacy impact assessment, and clear data-retention rules.
- **Account control.** Admins can instantly revoke access; disabled accounts lose access right away.
- **Audit trail.** The system records who accessed sensitive records — answering the school's question "who saw my child's data?"
- **Invitation-only onboarding.** Parents can only join when their school invites them, with a secure unique invite link plus the email code. No self-signup into someone else's organisation.
- **Lawful data handling.** Financial records are retained as the law requires, while personal data can be erased on request — handled separately and correctly.

**Marketing message:** "We treat children's data the way parents would want us to — and the way procurement officers require."

---

## 6. How It Works (the simple journey)

A clean story for a slide or two:

1. **The school invites a parent** by email.
2. **The parent clicks the invite** and enters the one-time code sent to their inbox.
3. **They land in their school's private portal** — already linked to their own child.
4. **They pay fees, check the calendar, book a meeting, and read notices** — all in one place.
5. **The admin sees payments update in real time** and manages everything from their dashboard.

No passwords. No app store download required. No data shared between schools.

---

## 7. The Technology (credibility slide — keep it light)

Built on a modern, proven, scalable stack so the product is fast, reliable, and secure:

- **Next.js + Vercel** — fast, modern web app, globally hosted.
- **Supabase (PostgreSQL)** — secure database with row-level data isolation.
- **Stripe** — world-class payments.
- **Resend** — reliable email delivery for login codes and notices.

Plus automated security scanning, secret protection, and continuous testing baked into the development process.

**Message:** "Enterprise-grade foundations, small-organisation simplicity."

---

## 8. Competitive Edge

- **Purpose-built** for the parent–child–organisation relationship (not a generic CRM or payment tool).
- **Passwordless** removes the #1 friction point for non-technical parents.
- **Privacy-first** — a real advantage when selling to schools that face strict procurement and data rules.
- **All-in-one** — payments, calendar, scheduling, and announcements in a single portal, not four separate subscriptions.
- **Multi-tenant** — one platform serves many organisations efficiently, keeping costs low.

---

## 9. Roadmap & Status (set expectations honestly)

- **Now:** Core platform in active development — secure onboarding, payments, and announcements are the priority ("must-have") features for version 1.
- **Launch market:** UK / EU schools, gyms, and clubs.
- **Coming next:** Calendar, fuller admin tools, and meeting scheduling.
- **Later:** Refunds, richer email features, and expansion to additional regions.

**Realistic delivery window:** roughly 3–4 months of focused build for the first launch-ready version.

---

## 10. Suggested Slide Structure (for NotebookLM to build from)

1. **Title** — WebComms & Pay: Parent communication and payments, simplified.
2. **The Problem** — the messy stack schools live with today.
3. **The Solution** — one platform, four jobs done.
4. **Key Features** — passwordless login, payments, calendar, booking, announcements.
5. **Security & Privacy** — built for children's data; isolation, compliance, audit.
6. **How It Works** — the 5-step parent journey.
7. **The Tech** — modern, proven, scalable (credibility).
8. **Why We Win** — competitive edge.
9. **Roadmap** — what's now, next, later.
10. **Call to Action** — invite a pilot school / book a demo.

---

## 11. Tone & Messaging Guidance

- **Audience is non-technical:** school administrators, club owners, and parents. Avoid jargon — say "private space per school," not "row-level security."
- **Lead with relief and simplicity** ("finally, one place"), then back it with trust ("and your children's data is safe").
- **Privacy is a feature, not fine print** — schools buy on trust.
- **Keep it warm and human.** This is about families and communities, not just software.

---

## 12. Soundbites / Pull Quotes

- "Pay, plan, and stay informed — all in one place."
- "No passwords. No paperwork. No data shared between schools."
- "Built for families. Trusted by schools."
- "We treat your child's data the way you would."
- "Enterprise-grade security, small-organisation simplicity."
