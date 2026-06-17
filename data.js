/* ============================================================
   WebComms & Pay — mock data (demo only)
   Two tenants prove database-layer isolation: each parent sees
   ONLY their own tenant's data. No network calls anywhere.
   ============================================================ */
window.DEMO = (function () {
  // Use a fixed "now" so the calendar/demo is deterministic.
  const YEAR = 2026, MONTH = 5; // June 2026 (0-indexed month)
  const iso = (d, h = 9, m = 0) => new Date(YEAR, MONTH, d, h, m);

  const tenants = {
    greenwood: {
      id: "t_greenwood",
      slug: "greenwood",
      name: "Greenwood Primary School",
      kind: "school",
      color: "#4f46e5",
      initials: "GP",
      currency: "GBP",
      symbol: "£",
    },
    riverside: {
      id: "t_riverside",
      slug: "riverside",
      name: "Riverside Gymnastics Club",
      kind: "club",
      color: "#0d9488",
      initials: "RG",
      currency: "GBP",
      symbol: "£",
    },
  };

  // Personas you can "log in" as. Each is bound to exactly one tenant
  // (except the system admin, who oversees all tenants).
  const personas = [
    { id: "p_amelia",  name: "Amelia Hughes", email: "amelia.parent@example.com", role: "parent",       tenant: "greenwood" },
    { id: "p_omar",    name: "Omar Farah",    email: "omar.parent@example.com",   role: "parent",       tenant: "riverside" },
    { id: "a_green",   name: "Sarah Bennett", email: "admin@greenwood.example",   role: "tenant_admin", tenant: "greenwood" },
    { id: "sys",       name: "Platform Ops",  email: "ops@webcommspay.example",   role: "system_admin", tenant: null },
  ];

  // Students belong to a tenant + a parent.
  const students = [
    { id: "s1", tenant: "greenwood", parent: "p_amelia", name: "Leo Hughes",   className: "Year 3 — Oak",  teacher: "Mr. Daniel Price" },
    { id: "s2", tenant: "greenwood", parent: "p_amelia", name: "Mia Hughes",   className: "Year 1 — Birch", teacher: "Ms. Karen Lowe" },
    { id: "s3", tenant: "riverside", parent: "p_omar",   name: "Yusuf Farah",  className: "Level 4 Squad",  teacher: "Coach Elena Vasiliev" },
  ];

  // Invoices reference a student. amount is in minor units (pence).
  const invoices = [
    { id: "i1", tenant: "greenwood", student: "s1", label: "Summer term tuition", amount: 42000, due: "30 Jun 2026", status: "pending" },
    { id: "i2", tenant: "greenwood", student: "s2", label: "Summer term tuition", amount: 42000, due: "30 Jun 2026", status: "pending" },
    { id: "i3", tenant: "greenwood", student: "s1", label: "School trip — Forest Park", amount: 1500, due: "20 Jun 2026", status: "pending" },
    { id: "i4", tenant: "greenwood", student: "s1", label: "Spring term tuition", amount: 42000, due: "31 Mar 2026", status: "paid" },
    { id: "i5", tenant: "riverside", student: "s3", label: "June coaching block", amount: 9000,  due: "28 Jun 2026", status: "pending" },
    { id: "i6", tenant: "riverside", student: "s3", label: "Competition entry — Regionals", amount: 3500, due: "15 Jun 2026", status: "pending" },
    { id: "i7", tenant: "riverside", student: "s3", label: "May coaching block", amount: 9000,  due: "28 May 2026", status: "paid" },
  ];

  const EV = { tuition: "#4f46e5", event: "#0d9488", meeting: "#d97706", holiday: "#db2777" };
  const events = [
    { tenant: "greenwood", date: iso(8),  type: "event",   label: "Sports Day" },
    { tenant: "greenwood", date: iso(12), type: "meeting", label: "Parents' Evening" },
    { tenant: "greenwood", date: iso(20), type: "event",   label: "Forest Park Trip" },
    { tenant: "greenwood", date: iso(26), type: "holiday", label: "INSET Day (closed)" },
    { tenant: "greenwood", date: iso(30), type: "tuition", label: "Tuition Due" },
    { tenant: "riverside", date: iso(14), type: "event",   label: "Regionals Meet" },
    { tenant: "riverside", date: iso(18), type: "meeting", label: "Coach Check-in" },
    { tenant: "riverside", date: iso(28), type: "tuition", label: "Coaching Fee Due" },
  ];
  const eventColor = (t) => EV[t] || "#64748b";

  // Appointment slots — only shown to parents whose child has that teacher.
  const slots = [
    { id: "sl1", tenant: "greenwood", teacher: "Mr. Daniel Price", day: "Thu 12 Jun", time: "16:00", booked: false },
    { id: "sl2", tenant: "greenwood", teacher: "Mr. Daniel Price", day: "Thu 12 Jun", time: "16:20", booked: false },
    { id: "sl3", tenant: "greenwood", teacher: "Mr. Daniel Price", day: "Thu 12 Jun", time: "16:40", booked: true  },
    { id: "sl4", tenant: "greenwood", teacher: "Ms. Karen Lowe",   day: "Thu 12 Jun", time: "17:00", booked: false },
    { id: "sl5", tenant: "greenwood", teacher: "Ms. Karen Lowe",   day: "Thu 12 Jun", time: "17:20", booked: false },
    { id: "sl6", tenant: "riverside", teacher: "Coach Elena Vasiliev", day: "Sat 14 Jun", time: "10:00", booked: false },
    { id: "sl7", tenant: "riverside", teacher: "Coach Elena Vasiliev", day: "Sat 14 Jun", time: "10:30", booked: false },
  ];

  const announcements = [
    { tenant: "greenwood", urgent: true,  title: "Early closure Friday", date: "16 Jun 2026", body: "School will close at 13:00 this Friday for staff training. After-school club is unaffected.", acked: false },
    { tenant: "greenwood", urgent: false, title: "Summer reading list", date: "10 Jun 2026", body: "The recommended summer reading list for each year group is now available from the school office.", acked: false },
    { tenant: "greenwood", urgent: false, title: "Lost property clear-out", date: "5 Jun 2026", body: "Unclaimed lost property will be donated at the end of term. Please check the rack by the main hall.", acked: true },
    { tenant: "riverside", urgent: true,  title: "Regionals kit reminder", date: "13 Jun 2026", body: "All squad members must bring their competition leotard and club tracksuit on Saturday. Doors open 09:15.", acked: false },
    { tenant: "riverside", urgent: false, title: "New beginner sessions", date: "8 Jun 2026", body: "We are opening two new beginner sessions on Wednesday evenings from July. Speak to reception to register.", acked: false },
  ];

  return {
    YEAR, MONTH, tenants, personas, students, invoices,
    events, eventColor, slots, announcements,
    money: (minor, sym) => sym + (minor / 100).toLocaleString("en-GB", { minimumFractionDigits: 2 }),
  };
})();
