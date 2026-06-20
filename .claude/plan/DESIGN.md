# DESIGN.md — UI/UX spec (Material 3 Expressive)

The visual source of truth for WebComms & Pay's frontend. Read this alongside
[PLAN.md](./PLAN.md): PLAN.md is the *contract* (schema, RLS, routes); this is
the *look and feel* those routes render. Where the two conflict on UI, this file
wins; where they conflict on data/behaviour, PLAN.md wins.

Status: **approved design spec, not yet built.** These are static mockups produced
in the design pass *before* Phase 1. No `src/` code implements them yet — they are
the target Phase 2–4 builds to.

---

## ⚠️ Divergence from PLAN.md — recorded deliberately

PLAN.md §Tech ([line 48](./PLAN.md)) names the UI library as **shadcn/ui + Tailwind**.
This spec instead adopts **Material 3 Expressive** (Google's latest design language).
This is a deliberate, owner-approved change, not an oversight.

- shadcn/ui (Radix + unstyled primitives) and Material 3 do **not** naturally coexist —
  shadcn's default aesthetic is a different system. Adopting M3 means **not** using
  shadcn's styled components as-is.
- The recommended implementation route (see "Implementation path" below) keeps
  **Tailwind** (so the Phase 0 setup survives) but drives it from an **M3 token theme**
  rather than shadcn's default theme.
- Phase 1's "install shadcn/ui" task should be re-scoped accordingly before it runs.

---

## Design thesis

The product is a parent's window into **their child's life at school/club** — money,
but also sports day, the forest trip, parents' evening. Generic SaaS dashboards bury
that under KPI tiles. Our organizing principle:

> **Child-first, not feature-first.** A parent thinks *"what's going on with Leo"*
> before *"open the invoices table."* The portal is organized around each child as a
> person, with a single household **"Needs you"** rail collapsing everything urgent
> (dues + dates) into one honest, actionable list.

Tone of copy: plain, active, end-user framed. Buttons name what happens
("Pay all £855.00", "Email me a code"), and an action keeps its name through the flow.
Security rules are explained in parents' words ("the invite link plus your inbox
together prove it's you"), never in system terms.

---

## Design tokens — Material 3 (seeded from indigo `#4f46e5`)

Tonal palette generated from the tenant primary seed. Every color role has an
`on-` pair and (for the key roles) a `container` variant. Per-tenant theming
re-seeds these from the tenant's own color (Greenwood indigo, Riverside teal).

### Color roles (light scheme)

| Role | Hex | On- | Container | On-container |
|------|-----|-----|-----------|--------------|
| Primary | `#4f46e5` | `#FFFFFF` | `#E3E0FF` | `#15006D` |
| Secondary | `#5B5D72` | `#FFFFFF` | `#E0E1F9` | `#181A2C` |
| Tertiary | `#79536A` | `#FFFFFF` | `#FFD8EC` | `#2E1124` |
| Error | `#BA1A1A` | `#FFFFFF` | `#FFDAD6` | `#410002` |
| Success* | `#2E6A45` | `#FFFFFF` | `#B3F1C6` | `#00210F` |
| Teal (Riverside seed) | `#0D9488` | `#FFFFFF` | `#C9EEE9` | `#00201C` |

\* M3 does not define a success role; this is an in-spirit green container for "Paid".

### Surfaces & neutrals

| Token | Hex |
|-------|-----|
| Background / Surface | `#FBF8FF` |
| On-surface | `#1B1B21` |
| On-surface-variant | `#46464F` |
| Surface container (1→5) | `#F3F0FA` · `#EDEAF6` · `#E7E4F2` · `#E5E2F0` · `#E1DEEE` |
| Surface-variant | `#E4E1EC` |
| Outline / Outline-variant | `#777680` / `#C7C5D0` |

Elevation is expressed as **surface tint + subtle shadow**, not heavy drop shadows
(`0 1px 3px` family). Higher elevation = higher surface-container tone.

### Typography

| Role | Face | Notes |
|------|------|-------|
| Display / headlines / titles | **Google Sans** (fallback: Product Sans → Roboto) | weight 400–500, used for h1/h2, card titles, buttons |
| Body / UI | **Roboto** | 14px base, 1.45 line-height |
| Numbers (amounts, stats) | Roboto / Google Sans, `font-variant-numeric: tabular-nums` | always tabular for alignment |

In the real app, load via `next/font` (Roboto + Google Sans). **Note:** the Artifact
mockups fall back to system fonts because the sandbox blocks the Google Fonts CDN —
the live app has no such limit and renders the true faces.

### Shape scale

`xs 8 · sm 12 · md 16 · lg 24 · xl 28 · full 999` (px). Buttons are **pill** (full
radius); cards 24px; the hero "Needs you" container 28px.

### Components (M3)

- **Buttons:** filled (primary action) · tonal (secondary-container) · outlined · text.
  All pill-shaped with a translucent **state-layer** overlay on hover/active.
- **Navigation rail** (desktop) with a FAB at top → collapses to a **bottom nav bar**
  on mobile (<820px).
- **Filled text fields:** filled surface, bottom underline, floating label; focus
  thickens the underline to primary.
- **Cards:** outlined or tonal-elevated; tonal **container** chips for status
  (Due → error-container, Paid → success-container, Invited → primary-container).
- **Tonal stat tiles** on admin dashboards (primary/secondary/tertiary/neutral mix).

---

## Signature elements (the things to get right)

1. **"Needs you" rail** — household-wide, top of the portal, primary-container hero.
   One list of every item needing the parent, each with child + due date, and a single
   **Pay all** filled button. This is the page's memorable element; keep everything
   around it quiet.
2. **Per-child ledger cards** — one card per child, outstanding balance as the hero
   number, the child's invoices as an inline ledger, the child's teacher + "Book
   meeting" in the footer.
3. **Booking is child-scoped** — pick the child first; you only ever see slots for
   teachers who actually teach that child (mirrors the Phase 4 IDOR authorization).

---

## Screen inventory (mapped to real App Router routes)

| # | Screen | Route | Phase |
|---|--------|-------|-------|
| 1 | Login / OTP verify / accept-invite | `(auth)/login` · `/verify` · `/accept-invite` | 2 |
| 2 | Parent portal (home: needs-you, children, term, notices) | `(tenant)/[slug]/portal` | 3 |
| 3 | Tenant admin — Manage (invite parent, families/students, invoices, announcements) | `(tenant)/[slug]/manage` | 2–3 |
| 4 | System admin — all-tenant overview / switcher | `(dashboard)/admin` | 2 |
| 5 | Book parent-teacher meeting | `[slug]/portal` (booking) | 4 |

Content is grounded in the real fixtures: Amelia Hughes (Greenwood) with Leo & Mia,
the demo invoices/events/announcements ([demo/data.js](../../demo/data.js)), and the
real schema shapes in [portal/page.tsx](../../src/app/(tenant)/[slug]/portal/page.tsx)
(amounts in minor units; `parent → student → tenant`; announcement acks).

---

## Quality floor (non-negotiable on every screen)

- Responsive to mobile (rail → bottom nav; grids → single column).
- Visible keyboard focus (`:focus-visible`, 3px primary outline).
- `prefers-reduced-motion` respected (transitions disabled).
- Status never by color alone — always a label too (Due / Paid / Urgent).
- Multi-tenant safety reflected visually: a parent only ever sees their own tenant;
  tenant color comes from the tenant record, never hard-coded per screen.

---

## Implementation path for Phase 1 (recommended)

**Tailwind + M3 token theme** (preserves the Phase 0 Next.js setup; the mockups
translate almost directly):

1. Re-scope PLAN.md's "install shadcn/ui" task. Keep Tailwind.
2. Add the color roles above as CSS custom properties + a Tailwind theme extension
   (`primary`, `primary-container`, `on-primary`, surfaces, etc.).
3. Load **Roboto + Google Sans** via `next/font`.
4. Build a small primitives layer (Button, TextField, Card, Chip, NavRail) to the
   M3 component specs above — these become the equivalents of the mockup classes.
5. Per-tenant theming: re-seed the palette from `tenant.color` at the `[slug]` layout.

Alternatives considered: **Material Web** (official M3 web components — heavier, less
Tailwind-native) and **MUI** (`@mui/material` — full M3 React kit, but a large dep and
its own styling engine that competes with Tailwind). Tailwind + tokens chosen for the
smallest divergence from Phase 0.

---

## Mockup references (session artifacts — not in repo)

These were published as Claude artifacts during the design pass. They are private to
the author's Claude account and may expire; this document is the durable record.

- Parent portal (Material 3): rebuilt M3 home screen
- Screen set (Material 3): auth · manage · system-admin · booking
- (Earlier serif/Fraunces direction — superseded by Material 3.)
