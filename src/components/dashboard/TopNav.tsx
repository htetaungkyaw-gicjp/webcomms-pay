/**
 * Dashboard top bar (server component). Shows the title + signed-in email and a
 * logout form posting to /api/auth/signout. M3: surface-container bar, display
 * font title. Logout is a real POST form so it works without JS.
 */
export function TopNav({
  title,
  email,
  subtitle,
}: {
  title: string;
  email?: string | null;
  subtitle?: string;
}) {
  return (
    <header className="flex items-center justify-between gap-4 rounded-[16px] bg-surface-container px-5 py-3">
      <div>
        <h1 className="font-display text-xl font-medium text-on-surface">{title}</h1>
        {subtitle && <p className="text-xs text-on-surface-variant">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        {email && (
          <span className="hidden text-sm text-on-surface-variant sm:inline">{email}</span>
        )}
        <form action="/api/auth/signout" method="post">
          <button
            type="submit"
            className="rounded-full px-4 h-9 text-sm font-medium text-primary hover:bg-primary/8"
          >
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
