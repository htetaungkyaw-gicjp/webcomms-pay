/* ============================================================
   WebComms & Pay — demo app (vanilla JS SPA)
   All state is in-memory. Reloading resets everything.
   ============================================================ */
(function () {
  const D = window.DEMO;
  const app = document.getElementById("app");

  // ---- session state (mutable, in-memory only) ----
  const state = {
    view: "landing",          // landing | login | otp | portal | admin
    pendingEmail: null,       // email entered at login step
    pendingPersona: null,     // persona chosen via quick-login
    user: null,               // logged-in persona
    activeTenant: null,       // tenant slug currently viewed (system_admin can switch)
    tab: "payments",          // active portal/admin tab
    calMonth: D.MONTH,
    calYear: D.YEAR,
  };
  // Working copies so "pay"/"book"/"ack" mutate without touching source.
  let invoices = clone(D.invoices);
  let slots = clone(D.slots);
  let announcements = clone(D.announcements);

  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

  // ---------- toast ----------
  function toast(msg, ok = false) {
    const host = document.getElementById("toast-host");
    const el = document.createElement("div");
    el.className = "toast" + (ok ? " ok" : "");
    el.innerHTML = (ok ? "✓ " : "") + esc(msg);
    host.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }

  // ---------- navigation ----------
  function go(view) { state.view = view; render(); window.scrollTo(0, 0); }

  function loginAs(persona) {
    state.user = persona;
    state.activeTenant = persona.tenant || D.tenants.greenwood.slug; // sys admin starts on first tenant
    state.tab = persona.role === "parent" ? "payments" : "students";
    state.view = persona.role === "system_admin" ? "admin" : "portal";
    render();
    window.scrollTo(0, 0);
  }

  function logout() {
    state.user = null; state.pendingEmail = null; state.pendingPersona = null;
    state.activeTenant = null;
    go("landing");
  }

  // ======================================================
  //  RENDER ROOT
  // ======================================================
  function render() {
    switch (state.view) {
      case "landing": return renderLanding();
      case "login":   return renderLogin();
      case "otp":     return renderOtp();
      case "portal":  return renderFrame();
      case "admin":   return renderFrame();
    }
  }

  // ======================================================
  //  LANDING
  // ======================================================
  function renderLanding() {
    app.innerHTML = `
      <div class="landing">
        <div class="nav">
          <div class="brand-mark"><span class="dot">✦</span> WebComms &amp; Pay</div>
          <button class="btn btn-ghost" id="nav-login">Log in</button>
        </div>
        <div class="hero">
          <span class="kicker">For schools · gyms · clubs</span>
          <h1>One trusted place<br/>for parents to pay, plan &amp; stay informed.</h1>
          <p class="lead">Passwordless email login, tuition payments, a shared calendar, parent-teacher
          booking and announcements — with every organisation's data isolated at the database layer.</p>
          <div class="hero-actions">
            <button class="btn btn-primary" id="cta-demo">Try the demo →</button>
            <a class="btn btn-ghost" href="https://github.com/htetaungkyaw-gicjp/webcomms-pay" target="_blank" rel="noopener">View source</a>
          </div>
        </div>
        <div class="features">
          ${feature("💳", "Tuition payments", "Parents pay fees by card. No card details are ever stored on the platform.")}
          ${feature("📅", "Shared calendar", "Term dates, events and holidays in one colour-coded calendar.")}
          ${feature("🗓️", "Parent-teacher booking", "Self-service slot booking, with double-booking prevented atomically.")}
          ${feature("📣", "Announcements", "Notices parents actually see — with read receipts for the office.")}
          ${feature("🔐", "Passwordless login", "Email one-time codes. No passwords to phish or reset.")}
          ${feature("🏫", "Multi-tenant isolation", "Each school or club only ever sees its own data — enforced in the database.")}
        </div>
        <p class="footer-note">
          This is an interactive <strong>demo</strong> with mock data — no real authentication, payments or personal data.
          The production system is a Next.js + Supabase + Stripe app. See the
          <a href="https://github.com/htetaungkyaw-gicjp/webcomms-pay" target="_blank" rel="noopener">implementation plan</a> in the repo.
        </p>
      </div>`;
    document.getElementById("nav-login").onclick = () => go("login");
    document.getElementById("cta-demo").onclick = () => go("login");
  }
  function feature(ic, h, p) {
    return `<div class="feature"><div class="ic">${ic}</div><h3>${esc(h)}</h3><p>${esc(p)}</p></div>`;
  }

  // ======================================================
  //  LOGIN (email)  +  quick personas
  // ======================================================
  function renderLogin() {
    app.innerHTML = `
      <div class="auth-wrap"><div class="auth-card">
        <button class="back-link" id="back">← Back</button>
        <div class="brand-mark" style="color:var(--ink);margin-bottom:14px;">
          <span class="dot">✦</span> WebComms &amp; Pay</div>
        <h2>Log in</h2>
        <p class="sub">Enter your email and we'll send a one-time code. No password needed.</p>
        <div class="field">
          <label for="email">Email address</label>
          <input class="input" id="email" type="email" placeholder="you@example.com" autocomplete="email" />
        </div>
        <button class="btn btn-primary btn-block" id="send">Send code</button>
        <p class="hint">Demo: any email works — the code is shown to you on the next screen.</p>

        <div style="margin:22px 0 8px; border-top:1px solid var(--line); padding-top:16px;">
          <p class="hint" style="margin:0 0 10px;">…or jump straight in as a sample user:</p>
          <div class="persona-grid" id="personas"></div>
        </div>
      </div></div>`;

    document.getElementById("back").onclick = () => go("landing");
    document.getElementById("send").onclick = () => {
      const v = document.getElementById("email").value.trim();
      if (!v || !v.includes("@")) { toast("Please enter a valid email"); return; }
      const match = D.personas.find(p => p.email.toLowerCase() === v.toLowerCase());
      state.pendingPersona = match || D.personas.find(p => p.id === "p_amelia");
      state.pendingEmail = v;
      go("otp");
    };

    const host = document.getElementById("personas");
    D.personas.forEach(p => {
      const t = p.tenant ? D.tenants[p.tenant] : null;
      const sub = p.role === "system_admin" ? "Platform admin · all tenants"
                : `${roleLabel(p.role)} · ${t.name}`;
      const b = document.createElement("button");
      b.className = "persona";
      b.innerHTML = `<span class="avi">${esc(initials(p.name))}</span>
        <span class="meta"><strong>${esc(p.name)}</strong><span>${esc(sub)}</span></span>`;
      b.onclick = () => { state.pendingPersona = p; state.pendingEmail = p.email; go("otp"); };
      host.appendChild(b);
    });
  }

  // ======================================================
  //  OTP verify
  // ======================================================
  function renderOtp() {
    const CODE = "123456";
    app.innerHTML = `
      <div class="auth-wrap"><div class="auth-card">
        <button class="back-link" id="back">← Back</button>
        <h2>Enter your code</h2>
        <p class="sub">We sent a 6-digit code to <strong>${esc(state.pendingEmail)}</strong>.</p>
        <div class="field">
          <label for="otp">One-time code</label>
          <input class="input otp-input" id="otp" inputmode="numeric" maxlength="6" placeholder="––––––" />
        </div>
        <button class="btn btn-primary btn-block" id="verify">Verify &amp; continue</button>
        <p class="hint">Demo code: <strong>${CODE}</strong> (pre-filled). In production this arrives by email and expires in minutes.</p>
      </div></div>`;
    const input = document.getElementById("otp");
    input.value = CODE;
    document.getElementById("back").onclick = () => go("login");
    document.getElementById("verify").onclick = () => {
      if (input.value.trim() !== CODE) { toast("Incorrect code — try " + CODE); return; }
      loginAs(state.pendingPersona);
    };
  }

  // ======================================================
  //  APP FRAME (portal + admin share the chrome)
  // ======================================================
  function renderFrame() {
    const u = state.user;
    const t = D.tenants[state.activeTenant];
    const isSys = u.role === "system_admin";

    const tabs = u.role === "parent"
      ? [["payments", "💳 Payments"], ["calendar", "📅 Calendar"], ["scheduling", "🗓️ Scheduling"], ["notices", "📣 Notices"]]
      : isSys
        ? [["tenants", "🏫 Tenants"], ["students", "👪 Members"], ["invoices", "💳 Invoices"], ["announcements", "📣 Announcements"]]
        : [["students", "👪 Students"], ["invoices", "💳 Invoices"], ["calendar", "📅 Calendar"], ["announcements", "📣 Announcements"]];

    if (!tabs.some(([k]) => k === state.tab)) state.tab = tabs[0][0];

    const tenantSwitch = isSys ? `
      <div class="tenant-switch">
        <span class="role-tag">viewing</span>
        <select id="tenant-select">
          ${Object.values(D.tenants).map(tt =>
            `<option value="${tt.slug}" ${tt.slug === state.activeTenant ? "selected" : ""}>${esc(tt.name)}</option>`).join("")}
        </select>
      </div>` : "";

    app.innerHTML = `
      <div class="frame">
        <div class="topbar">
          <div class="left">
            <div class="tenant-pill">
              <span class="logo" style="background:${t.color}">${esc(t.initials)}</span>
              ${esc(t.name)}
            </div>
            <span class="role-tag">${esc(roleLabel(u.role))}</span>
          </div>
          <div class="right">
            ${tenantSwitch}
            <div class="who"><span>signed in as</span><strong>${esc(u.name)}</strong></div>
            <button class="btn btn-ghost" id="logout">Log out</button>
          </div>
        </div>
        <div class="tabs" id="tabs">
          ${tabs.map(([k, lbl]) => `<button class="tab ${k === state.tab ? "active" : ""}" data-tab="${k}">${lbl}</button>`).join("")}
        </div>
        <div class="content" id="content"></div>
      </div>`;

    document.getElementById("logout").onclick = logout;
    document.querySelectorAll(".tab").forEach(b => b.onclick = () => { state.tab = b.dataset.tab; renderFrame(); });
    if (isSys) document.getElementById("tenant-select").onchange = (e) => { state.activeTenant = e.target.value; renderFrame(); };

    renderTab(document.getElementById("content"));
  }

  function isolationNote() {
    const t = D.tenants[state.activeTenant];
    return `<div class="iso"><span class="ic">🔐</span><div>
      <strong>Tenant isolation.</strong> You are seeing <strong>${esc(t.name)}</strong> data only.
      In production this boundary is enforced by PostgreSQL row-level security — not by the UI —
      so one organisation can never read another's records.</div></div>`;
  }

  function renderTab(c) {
    switch (state.tab) {
      case "payments":      return parentPayments(c);
      case "calendar":      return calendar(c);
      case "scheduling":    return scheduling(c);
      case "notices":       return notices(c, true);
      case "announcements": return notices(c, false);
      case "students":      return adminStudents(c);
      case "invoices":      return adminInvoices(c);
      case "tenants":       return sysTenants(c);
    }
  }

  // ---------- PARENT: Payments ----------
  function parentPayments(c) {
    const my = myStudents();
    const myInv = invoices.filter(i => i.tenant === state.activeTenant && my.some(s => s.id === i.student));
    const pending = myInv.filter(i => i.status === "pending");
    const paid = myInv.filter(i => i.status === "paid");
    const sym = D.tenants[state.activeTenant].symbol;
    const due = pending.reduce((a, i) => a + i.amount, 0);

    c.innerHTML = `
      ${isolationNote()}
      <h2 class="page-title">Payments</h2>
      <p class="page-sub">Tuition and fees for your children.</p>
      <div class="summary-grid">
        <div class="stat"><div class="label">Outstanding</div><div class="value">${D.money(due, sym)}</div></div>
        <div class="stat"><div class="label">Pending invoices</div><div class="value">${pending.length}</div></div>
        <div class="stat"><div class="label">Children</div><div class="value">${my.length}</div></div>
      </div>
      <div class="card">
        <div class="card-head"><h3>Outstanding (${pending.length})</h3>
          ${pending.length ? `<button class="btn btn-primary" id="pay-all">Pay all · ${D.money(due, sym)}</button>` : ""}</div>
        <div class="row-list">${pending.length ? pending.map(i => invLine(i, sym, true)).join("") : empty("All paid up — nothing outstanding 🎉")}</div>
      </div>
      <div class="card">
        <div class="card-head"><h3>Payment history</h3></div>
        <div class="row-list">${paid.length ? paid.map(i => invLine(i, sym, false)).join("") : empty("No past payments yet.")}</div>
      </div>`;

    if (pending.length) document.getElementById("pay-all").onclick = () => payModal(pending, sym);
    c.querySelectorAll("[data-pay]").forEach(b => b.onclick = () => {
      const inv = pending.find(i => i.id === b.dataset.pay);
      payModal([inv], sym);
    });
  }

  function invLine(i, sym, payable) {
    const s = D.students.find(x => x.id === i.student);
    const badge = i.status === "paid" ? `<span class="badge green">Paid</span>` : `<span class="badge amber">Due ${esc(i.due)}</span>`;
    const action = payable ? `<button class="btn btn-ghost" data-pay="${i.id}">Pay</button>` : "";
    return `<div class="line">
      <div class="info"><strong>${esc(i.label)}</strong><span>${esc(s.name)} · ${esc(s.className)}</span></div>
      <div class="trailing"><span class="amt">${D.money(i.amount, sym)}</span>${badge}${action}</div></div>`;
  }

  function payModal(list, sym) {
    const total = list.reduce((a, i) => a + i.amount, 0);
    const host = document.createElement("div");
    host.className = "modal-host";
    host.innerHTML = `
      <div class="modal">
        <h3>Checkout</h3>
        <p>This is a simulated Stripe Checkout. No card is charged and no card details are collected.</p>
        ${list.map(i => `<div class="pay-line"><span>${esc(i.label)}</span><span>${D.money(i.amount, sym)}</span></div>`).join("")}
        <div class="pay-total"><span>Total</span><span>${D.money(total, sym)}</span></div>
        <div class="modal-actions">
          <button class="btn btn-ghost btn-block" id="pay-cancel">Cancel</button>
          <button class="btn btn-primary btn-block" id="pay-confirm">Pay ${D.money(total, sym)}</button>
        </div>
        <p class="stripe-note">🔒 Powered by Stripe (simulated) · cards never touch our servers</p>
      </div>`;
    document.body.appendChild(host);
    const close = () => host.remove();
    host.addEventListener("click", e => { if (e.target === host) close(); });
    document.getElementById("pay-cancel").onclick = close;
    document.getElementById("pay-confirm").onclick = () => {
      list.forEach(i => { const r = invoices.find(x => x.id === i.id); if (r) r.status = "paid"; });
      close();
      toast(`Payment received — ${list.length} invoice${list.length > 1 ? "s" : ""} marked paid`, true);
      renderFrame();
    };
  }

  // ---------- Calendar (parent + admin) ----------
  function calendar(c) {
    const evs = D.events.filter(e => e.tenant === state.activeTenant);
    const first = new Date(state.calYear, state.calMonth, 1);
    const startDow = (first.getDay() + 6) % 7; // Mon=0
    const daysInMonth = new Date(state.calYear, state.calMonth + 1, 0).getDate();
    const monthName = first.toLocaleString("en-GB", { month: "long", year: "numeric" });
    const today = new Date(D.YEAR, D.MONTH, 17); // fixed "today" for demo

    let cells = "";
    const dow = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    dow.forEach(d => cells += `<div class="cal-dow">${d}</div>`);
    for (let i = 0; i < startDow; i++) cells += `<div class="cal-cell out"></div>`;
    for (let d = 1; d <= daysInMonth; d++) {
      const dayEvents = evs.filter(e => e.date.getDate() === d && e.date.getMonth() === state.calMonth && e.date.getFullYear() === state.calYear);
      const isToday = d === today.getDate() && state.calMonth === today.getMonth() && state.calYear === today.getFullYear();
      cells += `<div class="cal-cell ${isToday ? "today" : ""}">
        <span class="num">${d}</span>
        ${dayEvents.map(e => `<div class="ev" style="background:${D.eventColor(e.type)}" title="${esc(e.label)}">${esc(e.label)}</div>`).join("")}
      </div>`;
    }

    c.innerHTML = `
      ${isolationNote()}
      <h2 class="page-title">Calendar</h2>
      <p class="page-sub">Term dates, events and key deadlines.</p>
      <div class="cal">
        <div class="cal-head"><h3>${monthName}</h3>
          <div class="cal-nav"><button id="prev">‹</button><button id="next">›</button></div></div>
        <div class="cal-grid">${cells}</div>
        <div class="legend">
          <span class="lg"><span class="sw" style="background:#4f46e5"></span>Tuition</span>
          <span class="lg"><span class="sw" style="background:#0d9488"></span>Event</span>
          <span class="lg"><span class="sw" style="background:#d97706"></span>Meeting</span>
          <span class="lg"><span class="sw" style="background:#db2777"></span>Holiday</span>
        </div>
      </div>`;
    document.getElementById("prev").onclick = () => { shiftMonth(-1); renderFrame(); };
    document.getElementById("next").onclick = () => { shiftMonth(1); renderFrame(); };
  }
  function shiftMonth(n) {
    let m = state.calMonth + n, y = state.calYear;
    if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; }
    state.calMonth = m; state.calYear = y;
  }

  // ---------- Scheduling (parent) ----------
  function scheduling(c) {
    const my = myStudents();
    const teachers = [...new Set(my.map(s => s.teacher))];
    const mySlots = slots.filter(s => s.tenant === state.activeTenant && teachers.includes(s.teacher));

    const byTeacher = teachers.map(tch => {
      const child = my.find(s => s.teacher === tch);
      const list = mySlots.filter(s => s.teacher === tch);
      return `<div class="card">
        <div class="card-head"><h3>${esc(tch)}</h3><span class="role-tag">${esc(child.name)} · ${esc(child.className)}</span></div>
        <div class="card-body">
          <div class="slot-grid">
            ${list.map(s => `<button class="slot ${s.booked ? "booked" : ""}" data-slot="${s.id}" ${s.booked ? "disabled" : ""}>
              <strong>${esc(s.time)}</strong><span>${esc(s.day)}${s.booked ? " · booked" : ""}</span></button>`).join("")}
          </div>
        </div></div>`;
    }).join("");

    c.innerHTML = `
      ${isolationNote()}
      <h2 class="page-title">Book a parent-teacher meeting</h2>
      <p class="page-sub">Only your child's teacher's available slots are shown. Booked slots can't be double-booked.</p>
      ${byTeacher || empty("No slots available right now.")}`;

    c.querySelectorAll("[data-slot]").forEach(b => b.onclick = () => {
      const s = slots.find(x => x.id === b.dataset.slot);
      if (s.booked) return;
      s.booked = true;
      toast(`Booked ${s.day} at ${s.time} with ${s.teacher}`, true);
      renderFrame();
    });
  }

  // ---------- Notices (parent ack) / Announcements (admin view) ----------
  function notices(c, parent) {
    const list = announcements.filter(a => a.tenant === state.activeTenant);
    c.innerHTML = `
      ${isolationNote()}
      <h2 class="page-title">${parent ? "Notices" : "Announcements"}</h2>
      <p class="page-sub">${parent ? "Tap “Noted” so the office knows you've read it." : "Notices published to parents, with read receipts."}</p>
      <div class="card"><div class="row-list">
      ${list.length ? list.map((a, idx) => `
        <div class="notice">
          <div class="nhead"><h4>${esc(a.title)}</h4>${a.urgent ? `<span class="badge red">Urgent</span>` : `<span class="badge brand">Notice</span>`}</div>
          <p class="body">${esc(a.body)}</p>
          <div class="nhead">
            <span class="date">${esc(a.date)}</span>
            ${parent
              ? (a.acked ? `<span class="badge green">✓ Noted</span>` : `<button class="btn btn-ghost" data-ack="${idx}">Mark as noted</button>`)
              : `<span class="role-tag">${a.acked ? "read by you" : "unread sample"}</span>`}
          </div>
        </div>`).join("") : empty("No announcements yet.")}
      </div></div>`;

    if (parent) c.querySelectorAll("[data-ack]").forEach(b => b.onclick = () => {
      announcements[+b.dataset.ack].acked = true;
      toast("Marked as noted", true);
      renderFrame();
    });
  }

  // ---------- ADMIN: students / members ----------
  function adminStudents(c) {
    const list = D.students.filter(s => s.tenant === state.activeTenant);
    const t = D.tenants[state.activeTenant];
    const label = t.kind === "club" ? "Members" : "Students";
    c.innerHTML = `
      ${isolationNote()}
      <h2 class="page-title">${label}</h2>
      <p class="page-sub">Enrolled ${label.toLowerCase()} and their linked parent.</p>
      <div class="card"><div class="row-list">
      ${list.map(s => {
        const parent = D.personas.find(p => p.id === s.parent);
        return `<div class="line">
          <div class="info"><strong>${esc(s.name)}</strong><span>${esc(s.className)} · ${esc(s.teacher)}</span></div>
          <div class="trailing"><span class="role-tag">parent</span><span class="amt" style="font-weight:600">${esc(parent ? parent.name : "—")}</span></div>
        </div>`;
      }).join("")}
      </div></div>`;
  }

  // ---------- ADMIN: invoices ----------
  function adminInvoices(c) {
    const list = invoices.filter(i => i.tenant === state.activeTenant);
    const sym = D.tenants[state.activeTenant].symbol;
    const collected = list.filter(i => i.status === "paid").reduce((a, i) => a + i.amount, 0);
    const outstanding = list.filter(i => i.status === "pending").reduce((a, i) => a + i.amount, 0);
    c.innerHTML = `
      ${isolationNote()}
      <h2 class="page-title">Invoices</h2>
      <p class="page-sub">Fees raised across all ${D.tenants[state.activeTenant].kind === "club" ? "members" : "students"}.</p>
      <div class="summary-grid">
        <div class="stat"><div class="label">Collected</div><div class="value">${D.money(collected, sym)}</div></div>
        <div class="stat"><div class="label">Outstanding</div><div class="value">${D.money(outstanding, sym)}</div></div>
        <div class="stat"><div class="label">Invoices</div><div class="value">${list.length}</div></div>
      </div>
      <div class="card"><div class="row-list">
      ${list.map(i => invLine(i, sym, false)).join("")}
      </div></div>`;
  }

  // ---------- SYSTEM ADMIN: tenants ----------
  function sysTenants(c) {
    c.innerHTML = `
      <div class="iso"><span class="ic">🛡️</span><div><strong>Platform view.</strong>
        As <strong>system admin</strong> you can see every organisation. Switch the tenant selector
        (top-right) to view any tenant's data — every other role is locked to a single tenant.</div></div>
      <h2 class="page-title">Tenants</h2>
      <p class="page-sub">Organisations on the platform.</p>
      <div class="card"><div class="row-list">
      ${Object.values(D.tenants).map(t => {
        const studs = D.students.filter(s => s.tenant === t.slug).length;
        const inv = invoices.filter(i => i.tenant === t.slug).length;
        return `<div class="line">
          <div class="info" style="display:flex;align-items:center;gap:12px;">
            <span class="logo" style="width:34px;height:34px;border-radius:8px;display:grid;place-items:center;color:#fff;font-weight:800;background:${t.color}">${esc(t.initials)}</span>
            <span><strong>${esc(t.name)}</strong><span style="display:block;font-size:13px;color:var(--muted)">${esc(t.kind)} · /${esc(t.slug)}</span></span>
          </div>
          <div class="trailing"><span class="role-tag">${studs} members</span><span class="role-tag">${inv} invoices</span>
            <button class="btn btn-ghost" data-view="${t.slug}">View →</button></div>
        </div>`;
      }).join("")}
      </div></div>`;
    c.querySelectorAll("[data-view]").forEach(b => b.onclick = () => {
      state.activeTenant = b.dataset.view; state.tab = "students"; renderFrame();
    });
  }

  // ---------- helpers ----------
  function myStudents() {
    if (!state.user) return [];
    return D.students.filter(s => s.tenant === state.activeTenant && s.parent === state.user.id);
  }
  function roleLabel(r) { return { parent: "Parent", tenant_admin: "Admin", system_admin: "System admin" }[r] || r; }
  function initials(name) { return name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase(); }
  function empty(msg) { return `<div class="empty">${esc(msg)}</div>`; }

  // boot
  render();
})();
