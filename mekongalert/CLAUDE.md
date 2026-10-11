# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

MekhongAlert — cross-border AI disaster alert & multilingual emergency
communication platform (Thai DDPM ↔ Chinese emergency management tenants).
Full spec, schema rationale, and day-by-day build plan: `../MEKONGALERT_SPEC.md`.
`README.md` has the architecture diagram, demo script, and production deploy
notes — read it before making structural changes.

## Commands

Backend (`api/`):
```
cd api && pip install -r requirements.txt
uvicorn app.main:app --reload         # local dev (or: docker compose up from repo root)
```

Frontend (`web/`):
```
cd web && pnpm install
pnpm dev        # dev server
pnpm build      # tsc && vite build
pnpm lint       # tsc --noEmit — this is the only lint/typecheck step, no separate linter
```

Seed demo data (idempotent):
```
cd seed && pip install -r ../api/requirements.txt
set -a; source ../.env; set +a
python seed.py
```

There is no automated test suite (`seed/verify_day1.py` is a manual smoke
script, not part of a runner). Verify changes by running the app and hitting
the affected flow — see `docs/screenshots/` for what pages look like.

## Architecture

**Request path**: Dashboard/React → FastAPI (carrying the caller's Supabase
JWT) → Supabase Postgres, with Row Level Security enforced identically to a
direct Postgres query. FastAPI never uses the service-role key for
user-initiated reads/writes — only for webhooks and fan-out where no user JWT
exists (LINE webhook, broadcast).

- `api/app/deps.py` — `get_current_profile` verifies the Supabase JWT via
  JWKS (ES256/RS256, not a shared secret) and resolves `tenant_id`/`role`
  through an RLS-scoped query, so an invalid tenant claim can't be forged.
- `api/app/supabase_client.py` — two client factories: `get_user_client(jwt)`
  (anon key + caller's JWT, RLS-enforced) vs `get_service_client()`
  (service-role, bypasses RLS). Every router picks the one matching its
  auth context — check which one a router uses before adding a new query.
- **Tenant scoping is enforced two different ways depending on the table**:
  most tables have Postgres RLS policies keyed off
  `profiles.tenant_id` (see `supabase/migrations/0001_init.sql`). Three
  tables — `subscribers`, `citizen_reports`, `gauge_readings` — have RLS
  *enabled with no policies*, so they're reachable only through the
  service-role key, and tenant scoping for them is enforced in application
  code instead of SQL. Don't assume RLS alone protects those three.
- **Shared Incident Room**: `alert_shares` (from_tenant → to_tenant) is what
  makes an alert cross-tenant readable — RLS policies on `alerts`,
  `alert_translations`, `broadcasts` all check both direct tenant ownership
  and `alert_shares` membership. Writes stay owning-tenant-only.
- `api/app/routers/` — one file per resource, all registered in `main.py`.
- `api/app/services/` — LLM calls (localization, triage, impact assessment,
  chat translation, SITREP), LINE client/signature verification, TTS.
  `services/llm_json.py::call_claude_json` is the shared
  Claude-call-returning-JSON helper with a one-retry-on-parse-failure —
  reuse it for any new structured LLM call rather than hand-rolling
  `json.loads` on the response.
- `api/app/ingest/` — adapter pattern for upstream signal sources
  (`IngestAdapter.fetch() -> list[NormalizedAlert]`); adapters return
  drafts, they don't write to the DB. `mock_mekong.py`/`usgs_quake.py`
  are the current adapters; real MRC/TMD ingestion is Phase 2.
- `web/src/lib/api.ts` — thin fetch wrapper (`apiGet`/`apiPost`/`apiPatch`)
  that attaches the Supabase session JWT as a bearer token; all
  dashboard→API calls should go through this, not raw `fetch`.
- `web/src/lib/supabase.ts` — Supabase client for auth + direct
  storage/session access from the frontend (data reads/writes to
  RLS-protected tables go through the API instead, per the arch diagram).
- i18n: dashboard chrome in en/th/zh-CN via `web/src/lib/i18n.ts`
  (i18next); AI-generated alert content is separately localized per-alert
  into th/zh-CN/en/lo/vi and stored in `alert_translations`, not
  routed through i18next.

## Conventions

- SQL migrations are sequential and additive (`000N_description.sql` in
  `supabase/migrations/`) — never edit a migration that's already been
  applied to the shared Supabase project; add a new one.
- New tables/columns need an explicit RLS policy decision (tenant-scoped
  policy vs. service-role-only) — see the pattern and rationale in
  `0001_init.sql`'s RLS section before adding either.
- Passwords for seed/demo accounts are never committed; they're read from
  env vars at seed time or rotated via `api/scripts/rotate_demo_passwords.py`.

## Production

Live at `alert.harvesthubs.app` (frontend) / `alert-api.harvesthubs.app`
(API) on a shared Contabo VPS behind an existing Caddy reverse proxy
(`aib-v2` project) — see README.md's "Production deployment" section for
the redeploy commands. Routine redeploys don't touch the shared Caddy config.
