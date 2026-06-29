# UI/UX Polish Pass — WebComms & Pay

## Context

The app already has a real Material 3 design system (`src/app/globals.css` token theme + DESIGN.md) and most pages use the `ui/` primitives (`Button`, `Card`, `TextField`, `Chip`, `StatTile`) correctly. A survey of every page/component surfaced three concentrated gaps that read as "unfinished" against that system:

1. **Three pages bypass the design system entirely** with raw inline styles (`style={{ padding: 32 }}`, hard-coded `#555`, bare `<h1>/<p>`): the landing page and both Stripe return pages. These are the first and last screens a user sees, so they hurt most.
2. **Native form controls are hand-styled inline.** The exact string `h-12 rounded-t-[8px] border-0 border-b-2 border-outline bg-surface-container px-3 text-on-surface focus:border-primary outline-none` is copy-pasted across 4 `<select>` usages and a near-identical variant on 1 `<textarea>`; the urgent-flag `<input type="checkbox">` is fully unstyled. No primitive exists for these, so they drift from `TextField` and miss the focus ring.
3. **The tonal "pill nav / action button" pattern is duplicated.** The string `rounded-full px-4 h-9 grid place-items-center text-sm font-medium …` appears in `ManageNav`, `PortalNav`, `AppHeader` (twice), and the admin pages; `MarkPaidButton` is a raw `<button>` re-implementing a text-button. These should route through the existing `Button` (with a size option) or a small `NavPill` primitive.

Goal: close these gaps so the whole app reads as one coherent M3 surface, with no behavioural change — same routes, same data, same form submissions. Scope is "obvious rough edges" (confirmed with the user); micro-interactions/icons/empty-state components are explicitly out of scope. Result will be verified in a browser with screenshots.

## Approach

### 1. New `ui/` primitives (so forms stop hand-styling natives)

Match the look of the existing `TextField` (`src/components/ui/TextField.tsx`) — filled surface, bottom underline, label-above, error slot, `React.useId()` for the label association.

- **`src/components/ui/Select.tsx`** — `Select` component: same `{ label, error }` wrapper API as `TextField`, rendering a styled `<select>`. Pull the shared control classes into one constant so Select/Textarea/TextField visibly agree. Forward `value`/`onChange`/`children` (the `<option>`s) and `ref`.
- **`src/components/ui/Textarea.tsx`** — `Textarea` component: same wrapper, `<textarea>` with `rows` default 4, `rounded-t-[8px]` filled style + `py-2`.
- **`src/components/ui/Checkbox.tsx`** — `Checkbox` component: a real M3-styled checkbox (accent color via `accent-primary`, `size-4`, focus-visible inherits the global ring) with an inline label, replacing the bare `<input type="checkbox">`.

### 2. New `ui/NavPill` + `Button` size support (de-dupe nav/actions)

- **`src/components/ui/NavPill.tsx`** — a `next/link`-based pill with `active` boolean, encapsulating the duplicated `rounded-full px-4 h-9 grid place-items-center …` + active/inactive token classes. Used by `ManageNav`, `PortalNav`, and the admin tenant-list/detail action links.
- **`src/components/ui/Button.tsx`** — add a `size?: "sm" | "md"` prop (`md` = current `h-10 px-6`; `sm` = `h-8 px-3 text-xs`). Lets `MarkPaidButton` and `AppHeader`'s sign-out become real `Button variant="text"` instances instead of bespoke `<button>`s.

### 3. Restyle the three inline-styled pages to M3

- **`src/app/page.tsx`** (landing) — centered M3 layout: wordmark + role-free tagline in a `Card variant="tonal"` (or a clean hero block), the sign-in link as a `Button` (filled) wrapped in `Link`/`asChild`-style. Use `font-display`, `text-on-surface-variant` for the sub-copy, `min-h-screen grid place-items-center p-6` shell to match the auth pages.
- **`src/app/payment-success/page.tsx`** — success `Card` (success-container accent header, keep the ✅ inline for now since icons are out of scope), the existing explanatory copy in `text-on-surface-variant`, and a **filled "Back to portal" CTA**. The page has no slug in scope, so the CTA links to `/` (or reads a `?slug=`/referrer if trivially available — otherwise `/`); confirm the link target during implementation by checking how `checkout/route.ts` builds the `success_url`.
- **`src/app/payment-cancelled/page.tsx`** — same shell, neutral/tonal `Card`, copy in `text-on-surface-variant`, and a **"Return and try again" CTA** (same link logic as success).

### 4. Consistency sweep (low-risk token cleanups)

- Swap `opacity-70` / `opacity-80` secondary-text usages for `text-on-surface-variant` where they stand in for it (`StatTile` label, portal hero spans).
- Normalize stray `rounded-[12px]`/`rounded-[16px]` list-item radii toward the M3 scale already in `@theme` (`rounded-sm`/`rounded-md`) where they're meant to be cards; leave intentional ones.
- Apply `.tabular` to money/stat numbers that currently omit it (invoices table amounts, portal ledger).
- Make `manage/announcements` list items use the `Card` primitive (or its outlined classes) instead of bespoke `rounded-[16px] border` to match the rest.

### Wiring (consume the new primitives)

Replace the inline natives with the new components in:
- `src/components/dashboard/CreateInvoiceForm.tsx` → `Select`
- `src/components/dashboard/CreateEventForm.tsx` → `Select`
- `src/components/dashboard/CreateSlotForm.tsx` → `Select`
- `src/components/tenant/BookingPicker.tsx` → `Select` (+ its slot list-items stay, optionally normalized radius)
- `src/components/dashboard/CreateAnnouncementForm.tsx` → `Textarea` + `Checkbox`
- `src/components/dashboard/ManageNav.tsx`, `src/components/tenant/PortalNav.tsx` → `NavPill`
- `src/components/dashboard/AppHeader.tsx` → `NavPill` for links, `Button size="sm" variant="text"` for sign-out
- `src/components/dashboard/MarkPaidButton.tsx` → `Button size="sm" variant="text"`
- `src/app/(dashboard)/admin/page.tsx` & `admin/tenants/[tenantId]/page.tsx` → `NavPill`/`Button` for the inline action links and the hardcoded 4th stat cell

## Out of scope (deferred)

Button state-layer ripple/animation, an icon set to replace ✓/✅ emoji, a reusable `EmptyState` component, the portal "Needs you" hero redesign, and the react-big-calendar theme reconciliation. These are the "finishing touches" tier and can be a follow-up.

## Verification

1. `npm run lint` — must pass clean (new primitives + edited consumers).
2. `npm run dev`, then drive the browser (Playwright MCP) to screenshot and eyeball:
   - `/` (landing) — new M3 hero + CTA.
   - `/payment-success` and `/payment-cancelled` — Card layout + working CTA.
   - One **manage** page with a form (e.g. `…/manage/invoices` or `/announcements`) — Select/Textarea/Checkbox render identically to TextField, focus ring visible on tab.
   - One **portal** page — PortalNav pills unchanged visually, active state correct.
3. Tab through a form to confirm `:focus-visible` ring shows on the new Select/Textarea/Checkbox (DESIGN.md quality floor).
4. Confirm no behavioural regression: each restyled form still submits (network call fires) and nav links still route. No migrations, no API, no RLS touched — this is presentation-only.
