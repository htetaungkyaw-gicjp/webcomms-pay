# WebComms &amp; Pay — Interactive Demo

A **static, mock-data** demo of [WebComms &amp; Pay](https://github.com/htetaungkyaw-gicjp/webcomms-pay) — a multi-tenant,
passwordless parent portal for schools, gyms and clubs. Built before real development
to show the concept end-to-end.

🔗 **Live:** https://htetaungkyaw-gicjp.github.io/webcomms-pay/

> ⚠️ **Demo only.** Everything is mock data held in the browser. There is **no real
> authentication, no real payments, and no personal data**. Nothing is sent anywhere.
> Reloading the page resets all state.

## What it shows

- **Landing page** — the product pitch.
- **Passwordless login** — simulated email one-time code (demo code: `123456`).
- **Parent portal** — Payments (simulated Stripe checkout), Calendar, Parent-teacher
  Scheduling, and Notices with read receipts.
- **Tenant admin** — students/members, invoices, announcements.
- **System admin** — switch between tenants to see **database-layer tenant isolation**:
  every non-admin role is locked to a single organisation.

Try logging in as any of the sample users on the login screen, or use the system admin
to switch between *Greenwood Primary School* and *Riverside Gymnastics Club*.

## Tech

Plain HTML / CSS / vanilla JS — no build step. Served directly by GitHub Pages.
The production system is Next.js 16 + Supabase (RLS) + Stripe.

## Run locally

Just open `index.html` in a browser, or serve the folder:

```bash
python -m http.server 8000   # then visit http://localhost:8000
```
