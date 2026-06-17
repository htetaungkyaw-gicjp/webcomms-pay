<!-- ch-3 personal-project report. Copy this file to ch-3/<your-github-username>/report.md -->
# ch-3 Personal Project — Report

github_username: htetaungkyaw-gicjp
personal_repo_url: https://github.com/htetaungkyaw-gicjp/webcomms-pay
project_summary: WebComms & Pay — a multi-tenant, passwordless parent-communication and payments platform for schools, gyms, and clubs (Email OTP login, Stripe payments, calendar, meeting booking, announcements).
slides_url: slides/webcomms-pay-pechakucha.md

## Methodology
<!-- How you worked: project-based approach + your git workflow (commit as you build). 2-4 sentences. -->
I drove the build with Claude Code in plan mode first — exploring the repo and writing an approved implementation plan ([.claude/plan/PLAN.md](https://github.com/htetaungkyaw-gicjp/webcomms-pay/blob/main/.claude/plan/PLAN.md)) before any code. I then committed each artifact as its own small commit (`.env.example` → `.mcp.json` → skill → agent → slides) so the git history reads as a build log. Before publishing I ran my own `secret-leak-auditor` agent as a gate to confirm no keys were tracked — every secret in `.mcp.json` and `.env.example` is a `${...}` placeholder, never a real value, because the repo is public.

## Evidence — Claude Code usage
<!-- List the ACTUAL paths in your personal repo. The validator checks these exist. -->

### MCP
- path: .mcp.json
- what: Two stdio MCP servers — **Supabase** (`@supabase/mcp-server-supabase`, started with `--read-only`) for safe DB schema/RLS introspection, and **GitHub** (`@modelcontextprotocol/server-github`) for PRs and repo operations. Credentials are injected via `${SUPABASE_PROJECT_REF}`, `${SUPABASE_ACCESS_TOKEN}`, and `${GITHUB_PERSONAL_ACCESS_TOKEN}` env expansion — no secrets in the file.

### Skill
- path: .claude/skills/rls-policy-check/SKILL.md
- what: Audits a Supabase migration / RLS policy file against WebComms & Pay's tenant-isolation invariants (system_admin short-circuit, helpers in the `private` schema with `search_path = ''`, append-only `audit_log`, the double-booking partial unique index with no `is_booked` flag) and reports a pass/fail list with `file:line` for each violation.

### Agent
- path: .claude/agents/secret-leak-auditor.md
- what: A read-only subagent that scans the working tree and git history for committed secrets (Stripe/Resend/Supabase/GitHub key patterns), verifies `.gitignore` covers `.env*` and `.claude/settings.local.json`, and confirms `.mcp.json` uses only `${...}` expansion — run as a gate before making the repo public.
