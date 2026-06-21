/**
 * Per-tenant theming hook (DESIGN.md §Implementation path step 5). When tenants
 * gain a `color` column, re-seed the M3 palette here by setting the --md-primary*
 * CSS vars inline on a wrapper. For now it's a pass-through keeping the default
 * indigo seed — the wrapper exists so the swap is a one-file change later.
 */
export function TenantTheme({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen">{children}</div>;
}
