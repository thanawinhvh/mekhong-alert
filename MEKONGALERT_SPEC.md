# MekongAlert — Build Specification for Claude Code

> **Working title:** MekongAlert · Thai: เตือนภัยลุ่มโขง · Chinese display name: **澜湄预警** (ties into the 澜湄合作 / Lancang-Mekong Cooperation framework — use this in zh UI).
> Cross-border AI disaster alert & multilingual emergency communication platform.
> Competition entry: 2026 China (Guangxi)–ASEAN "AI + Emergency Management" Innovation Competition — **Track 5 (Universities & ASEAN track)**.

---

## 0. Mission & hard constraints — READ FIRST

- **7-day build window.** Registration closes 19 Jul 2026; preliminary round is judged on a proposal PDF + demo video/links in late July. A clickable end-to-end demo must exist in 7 days. Build **P0 scope only** (§6). Everything in §7 is explicitly out of scope — do not build it even if it seems easy.
- **The demo tells ONE story:** cross-border Mekong flood early warning between **Mukdahan DDPM (Thailand)** and **Qinzhou Emergency Management Bureau (Guangxi, China)**. Every feature must serve a beat in the demo script (§9).
- Judging criteria to optimize for: innovation, scenario fit, technical merit, **ASEAN application potential**, project completeness.
- Solo developer + Claude Code. Reuse the owner's proven patterns: Supabase multi-tenant RLS, LINE Messaging API, FastAPI, React 19 + Ant Design (same patterns as LaungPro / AIB POS / Panit).
- Production-ready style: strict TypeScript, env-based config, no secrets in repo, Docker for backend, deployable from day 1.
- **Time rule:** if any external data source or integration blocks progress for more than 30 minutes, switch to the mock adapter (§6.1) and move on. Demo realism > live data.

## 1. One-paragraph product definition

MekongAlert ingests official disaster signals (river levels, weather warnings) and operator-created incidents, uses an LLM to (a) classify severity and (b) rewrite technical bulletins into **plain-language, location-specific action guidance in 5 languages (th, zh-CN, en, lo, vi)**, then broadcasts through channels people actually use: LINE push for Thailand, a public web status page, and downloadable **TTS voice bulletins for village loudspeaker towers (หอกระจายข่าว)**. Citizens reply through LINE with photos + location; an LLM triages reports onto a live map. Agencies on both sides of the border collaborate in a **Shared Incident Room**: an alert created by the Thai tenant can be shared to the Chinese tenant and is instantly readable in their language.

## 2. Tech stack — LOCKED, do not substitute

| Layer | Choice |
|---|---|
| Dashboard + public page | React 19 + TypeScript + Ant Design + Vite → Cloudflare Pages |
| Citizen mini-app | LINE LIFF (React, same repo, separate route `/liff`) |
| Backend | FastAPI (Python 3.12) + uvicorn, Docker → existing VPS via git-based deploy |
| DB / Auth / Storage | Supabase (new project `mekongalert`): Postgres + RLS, Supabase Auth (email/password for operators), Storage bucket `report-photos`, bucket `tts-audio` |
| LLM | Anthropic Claude API (`claude-sonnet-4-6`) for ALL AI: localization, severity classification, report triage |
| Messaging | LINE Messaging API (push + webhook) — new LINE OA channel for this product |
| TTS | `edge-tts` (free; has voices for th-TH, zh-CN, vi-VN, lo-LA, en-US) → MP3 saved to Supabase Storage |
| Map | Leaflet + OpenStreetMap tiles (no API key needed) |
| i18n (UI chrome) | react-i18next — dashboard UI in `en`, `th`, `zh-CN` |

Suggested deploy targets (Cloudflare DNS already managed): dashboard `alert.harvesthubs.app`, API `alert-api.harvesthubs.app`.

## 3. Repo layout (monorepo)

```
mekongalert/
├── web/                  # React 19 + Vite (dashboard, public status page, LIFF)
│   ├── src/pages/        # login, overview, alerts, alert-detail, reports, settings, public-status, liff-onboard
│   ├── src/components/
│   ├── src/lib/          # supabase client, api client, i18n
│   └── ...
├── api/                  # FastAPI
│   ├── app/main.py
│   ├── app/routers/      # alerts, reports, broadcast, tts, line_webhook, public
│   ├── app/services/     # ai_localizer, ai_triage, line_client, tts_service, ingest/
│   ├── app/ingest/       # adapter interface + manual/mock_mekong/mock_cma adapters
│   └── Dockerfile
├── supabase/migrations/  # SQL (schema + RLS + seed)
├── seed/                 # seed script + demo assets (stock flood photos)
├── docker-compose.yml    # api + local dev convenience
├── .env.example
└── SPEC.md               # this file
```

## 4. Multi-tenancy model

- **tenant = emergency agency.** Seed two: `mukdahan-ddpm` (สำนักงาน ปภ.จังหวัดมุกดาหาร, default lang `th`) and `qinzhou-emb` (钦州市应急管理局, default lang `zh-CN`).
- `profiles` maps `auth.users` → `tenant_id` + role (`admin` | `operator` | `viewer`).
- RLS on every table keyed by `tenant_id`, same pattern as the owner's other products. Cross-tenant visibility happens **only** through `alert_shares` (§6.5).
- Backend uses the service-role key server-side only (webhook writes, broadcasts); the dashboard talks to FastAPI with the user's Supabase JWT, which FastAPI verifies.

## 5. Database schema (write as Supabase migration SQL)

```sql
create table tenants (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name_en text not null, name_th text, name_zh text,
  country text not null check (country in ('TH','CN')),
  default_lang text not null default 'en',
  created_at timestamptz default now()
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid not null references tenants(id),
  display_name text,
  role text not null default 'operator' check (role in ('admin','operator','viewer')),
  created_at timestamptz default now()
);

create table areas (              -- simplified admin units (district level)
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  code text not null,             -- e.g. TH-MDH-MUEANG, CN-QZ-QINNAN
  name_local text not null, name_en text not null,
  lat double precision, lng double precision,
  unique (tenant_id, code)
);

create table subscribers (        -- LINE citizens
  id uuid primary key default gen_random_uuid(),
  line_user_id text unique not null,
  display_name text,
  lang text not null default 'th',
  area_codes text[] not null default '{}',
  lat double precision, lng double precision,   -- optional shared location
  consented boolean not null default true,
  created_at timestamptz default now()
);

create table alerts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  source text not null default 'manual' check (source in ('manual','mekong_gauge','cma_mock','auto')),
  event_type text not null check (event_type in ('flood','storm','landslide','fire','earthquake','other')),
  severity int not null check (severity between 1 and 5),
  headline text not null,          -- source-language headline
  description text not null,       -- source-language body
  source_lang text not null default 'th',
  area_codes text[] not null default '{}',
  center_lat double precision, center_lng double precision, radius_km double precision,
  onset_at timestamptz, expires_at timestamptz,
  status text not null default 'draft' check (status in ('draft','localized','approved','broadcast','expired')),
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

create table alert_translations (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid not null references alerts(id) on delete cascade,
  lang text not null,               -- th | zh-CN | en | lo | vi
  headline text not null,
  guidance jsonb not null,          -- array of 3–5 short imperative action strings
  tts_script text,
  tts_url text,
  model text,
  unique (alert_id, lang)
);

create table alert_shares (        -- Shared Incident Room
  id uuid primary key default gen_random_uuid(),
  alert_id uuid not null references alerts(id) on delete cascade,
  from_tenant uuid not null references tenants(id),
  to_tenant uuid not null references tenants(id),
  note text,
  created_at timestamptz default now(),
  unique (alert_id, to_tenant)
);

create table citizen_reports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id),      -- resolved from subscriber area
  line_user_id text,
  message_text text,
  photo_url text,
  lat double precision, lng double precision,
  ai_category text, ai_severity int, ai_summary_en text, ai_summary_local text,
  ai_credibility text check (ai_credibility in ('low','medium','high')),
  status text not null default 'new' check (status in ('new','verified','dismissed','resolved')),
  linked_alert_id uuid references alerts(id),
  created_at timestamptz default now()
);

create table broadcasts (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid not null references alerts(id),
  channel text not null check (channel in ('line','tts','web')),
  audience_count int default 0,
  status text not null default 'sent',
  sent_at timestamptz default now()
);

create table gauge_readings (      -- mock/live Mekong water level timeseries
  id bigint generated always as identity primary key,
  station text not null default 'MUKDAHAN',
  level_m double precision not null,
  flood_stage_m double precision not null default 12.5,
  reading_at timestamptz not null
);
```

**RLS:** enable on all tables. Pattern:

```sql
alter table alerts enable row level security;
create policy tenant_read on alerts for select using (
  tenant_id = (select tenant_id from profiles where id = auth.uid())
  or id in (select alert_id from alert_shares
            where to_tenant = (select tenant_id from profiles where id = auth.uid()))
);
create policy tenant_write on alerts for insert with check (
  tenant_id = (select tenant_id from profiles where id = auth.uid())
);
```

Apply the same tenant-scoped pattern everywhere; `subscribers`, `citizen_reports`, `gauge_readings`, and Storage writes go through the service role in FastAPI. Verify with a test: user of tenant A must NOT see tenant B's unshared alerts.

## 6. P0 features (build in this order)

### 6.1 Alert ingestion
- `IngestAdapter` interface: `fetch() -> list[NormalizedAlert]`.
- Implement three adapters: **ManualAdapter** (operator form is the primary path), **MockMekongAdapter** (reads `gauge_readings`; when latest level ≥ flood_stage − 0.5 m, auto-drafts a flood alert for the riverside districts), **MockCmaAdapter** (one canned Guangxi typhoon alert for the Chinese tenant demo).
- Live MRC/TMD integration = stretch goal ONLY after §14 checklist passes. Structure the adapter interface so it can be added later; say so in the README roadmap.

### 6.2 AI Localization Engine
- `POST /api/alerts/{id}/localize` → one Claude call → strict JSON (prompt in §10.1) → upsert 5 rows in `alert_translations`, set alert status `localized`.
- Dashboard alert detail shows one tab per language with headline + guidance bullets + "Regenerate" button. Operator reviews, then clicks **Approve**.

### 6.3 Broadcast
- **LINE:** flex message — severity color band (1 green → 5 red), localized headline, 3 action bullets, static map link, and a "📷 รายงานสถานการณ์ / Report" quick-reply. Push to subscribers whose `area_codes` intersect `alert.area_codes` (or within `radius_km` if they shared GPS). Respect each subscriber's `lang`.
- **TTS:** `POST /api/alerts/{id}/tts?lang=xx` → edge-tts → MP3 → Storage → save `tts_url`. Dashboard shows play + download buttons per language ("for village loudspeaker").
- Log every send in `broadcasts` with audience_count.

### 6.4 Citizen loop (LINE)
- **LIFF onboarding** (`/liff`): pick language (th/lo/vi/zh/en), pick province → districts (from `areas`), optional "share my location" → creates/updates `subscribers`.
- **Webhook** `POST /webhooks/line` (verify X-Line-Signature): text / image / location messages → create `citizen_reports` (image → Storage) → fire async Claude triage (§10.2) → fills `ai_*` fields → reply to the citizen with a localized acknowledgment.
- Dashboard `/reports`: table + map pins with photo popover; operator sets status verify / dismiss / link-to-alert.

### 6.5 Shared Incident Room — the differentiator, polish this
- "Share to partner agency" button on alert detail → picks target tenant → `alert_shares` row.
- Target tenant's dashboard shows the alert read-only, rendered in **their default language** from `alert_translations`, with a badge: `Shared from สำนักงาน ปภ.มุกดาหาร 🇹🇭` / `来自泰国莫拉限府减灾办 🇹🇭`.
- Overview map renders shared alerts with a distinct dashed-border style.

### 6.6 Pages
- `/login` (Supabase Auth) · `/overview` (4 stat cards: active alerts, people notified, new reports, shared incidents + Leaflet map + water-level line chart from `gauge_readings`) · `/alerts` (table + composer drawer) · `/alerts/:id` (translation tabs, broadcast panel, TTS panel, share panel) · `/reports` · `/settings` (tenant info, areas list).
- Public `/status/:tenantSlug`: active alerts in card list, language switcher (5 langs), no login. This URL goes in the proposal PDF.

## 7. Descope — do NOT build

Native mobile apps · real SMS gateway (render a disabled "SMS fallback — Phase 2" button) · WeChat/Zalo channels (roadmap slide only) · real IoT sensor ingestion (Phase-2 section in README only; mention Harvest Hub IoT water-level sensors as the hardware roadmap) · GIS polygons (district-code + radius matching is enough) · user management UI (seed users only) · notification queue infra (synchronous loop over subscribers is fine at demo scale).

## 8. Seed & demo mode

Seed script (`seed/seed.py`, idempotent) creates:
- 2 tenants; 4 users: `admin@mukdahan.demo`, `op@mukdahan.demo`, `admin@qinzhou.demo`, `op@qinzhou.demo` (password from env).
- Areas — Mukdahan districts: เมืองมุกดาหาร, หว้านใหญ่, ดอนตาล, นิคมคำสร้อย, ดงหลวง, คำชะอี, หนองสูง. Qinzhou districts: 钦南区, 钦北区, 灵山县, 浦北县.
- 30 days of `gauge_readings` for station MUKDAHAN trending upward toward flood stage 12.5 m (latest ≈ 11.6 m).
- 3 historical alerts (1 broadcast, 1 expired, 1 shared), 5 citizen reports with placeholder flood photos, a few demo subscribers.
- `DEMO_MODE=true` enables a **"⚡ Simulate rising water"** button on the overview page: inserts readings that cross the threshold → MockMekongAdapter auto-drafts a severity-3 flood alert. This scripted moment opens the demo video.

## 9. Demo video script (3 min) — the build must support every beat

1. **0:00–0:30** Overview dashboard: water-level chart climbing → press Simulate → chart crosses red flood line → auto-drafted flood alert pops up for 3 riverside districts.
2. **0:30–1:10** Open draft → click **AI Localize** → five language cards render (th, zh-CN, en, lo, vi) with plain-language guidance.
3. **1:10–1:40** Approve → Broadcast → cut to phone screen recording: LINE push arrives in Thai with severity color + actions.
4. **1:40–2:15** Citizen replies with flood photo + location → pin appears on dashboard map, AI triage summary + credibility shown.
5. **2:15–2:45** Click **Share to 钦州市应急管理局** → switch to the Qinzhou account → same incident, Chinese UI, "shared from Thailand" badge. *(The cross-border money shot — hold on it.)*
6. **2:45–3:00** Play TTS bulletin in Thai, then Lao — "same warning, every language on the river."

## 10. LLM prompt templates (implement verbatim; tune only after E2E works)

### 10.1 Localizer — system prompt

```
You are the localization engine of MekongAlert, a cross-border disaster alert
platform for the Mekong region (Thailand–Laos–Vietnam–China/Guangxi).

Input: one official alert (JSON) with event_type, severity(1-5), headline,
description, area names, onset/expiry times, source language.

Task: produce citizen-facing content in ALL of: th, zh-CN, en, lo, vi.

Rules:
- Plain language for rural citizens. No technical jargon, no bureaucratic tone.
- Always name the specific affected areas in the local script.
- Give timing when known ("within the next 6 hours" style).
- guidance = 3 to 5 short imperative actions, most urgent first
  (e.g. move belongings to high ground, prepare documents, check on elders).
- NEVER invent evacuation orders, casualty numbers, or facts not in the source.
- tts_script = one flowing spoken paragraph (~15 seconds), suitable for a
  village loudspeaker, starting with an attention phrase in that language.
- severity_check: restate 1-5 severity; if the source text clearly implies a
  different severity than provided, say so in `severity_note` (English).

Return ONLY valid JSON:
{
  "severity_check": 1-5,
  "severity_note": "",
  "translations": {
    "th":    {"headline": "", "guidance": ["",""], "tts_script": ""},
    "zh-CN": {"headline": "", "guidance": ["",""], "tts_script": ""},
    "en":    {"headline": "", "guidance": ["",""], "tts_script": ""},
    "lo":    {"headline": "", "guidance": ["",""], "tts_script": ""},
    "vi":    {"headline": "", "guidance": ["",""], "tts_script": ""}
  }
}
```

### 10.2 Citizen report triage — system prompt

```
You triage citizen disaster reports for an emergency operations dashboard.
Input: optional text (any language), optional photo, optional GPS, plus the
list of currently active alerts (id, type, areas).

Return ONLY valid JSON:
{
  "category": "flood|storm|landslide|fire|earthquake|infrastructure|other|not_disaster",
  "severity": 1-5,
  "credibility": "low|medium|high",
  "summary_en": "one sentence",
  "summary_local": "one sentence in the reporter's language",
  "matched_alert_id": "uuid or null",
  "reply_to_citizen": "short thank-you + one safety tip, in the reporter's language"
}

Rules: judge credibility from consistency of photo/text/location; mark selfies,
memes, ads as not_disaster with low credibility. Never promise rescue dispatch.
```

## 11. API surface (FastAPI)

```
POST /api/alerts                     create draft (operator)
GET  /api/alerts?status=&tenant=     list (RLS-scoped)
GET  /api/alerts/{id}                detail + translations + shares
POST /api/alerts/{id}/localize       run §10.1, upsert translations
POST /api/alerts/{id}/approve
POST /api/alerts/{id}/broadcast      LINE push + log
POST /api/alerts/{id}/tts?lang=      generate/store MP3, return url
POST /api/alerts/{id}/share          body: {to_tenant_slug, note}
GET  /api/reports                    list citizen reports
PATCH /api/reports/{id}              status / link alert
GET  /api/gauge?station=             timeseries for chart
POST /api/demo/simulate-rise         DEMO_MODE only
POST /webhooks/line                  LINE events (signature-verified)
GET  /public/status/{tenant_slug}    no auth, active alerts JSON
```

Auth: dashboard calls carry the Supabase JWT (verify signature + read `sub` → profile/tenant). Webhook and broadcast paths use the service-role key internally. CORS: allow the dashboard origin only.

## 12. .env.example

```
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-4-6
LINE_CHANNEL_ACCESS_TOKEN=
LINE_CHANNEL_SECRET=
LIFF_ID=
DEMO_MODE=true
SEED_USER_PASSWORD=
PUBLIC_WEB_URL=https://alert.harvesthubs.app
API_URL=https://alert-api.harvesthubs.app
```

## 13. Build order (7 days — finish each day's acceptance before moving on)

| Day | Deliverable | Done when |
|---|---|---|
| 1 | Repo scaffold, Supabase migration + RLS, auth, seed script, docker-compose | Both demo users log in and see only their tenant |
| 2 | Alert model + composer drawer + alerts table + Leaflet overview map + gauge chart | Manual alert renders on map |
| 3 | AI Localization Engine + translation tabs UI | One click → 5 language cards |
| 4 | LINE OA: LIFF onboarding + broadcast push | Real phone receives Thai flex message |
| 5 | Citizen webhook + triage + reports page with pins | Photo report appears on map with AI summary |
| 6 | Shared Incident Room + TTS + public status page + Simulate button | Full §9 script runs end to end |
| 7 | Polish (severity colors, badges, i18n chrome, empty states), deploy, record video | Video recorded in one take |

## 14. Acceptance checklist

- [ ] Fresh clone → `.env` → `docker compose up` + `pnpm dev` works; seed idempotent.
- [ ] Entire §9 demo script executable with zero code edits.
- [ ] RLS verified: tenant A cannot read tenant B's unshared alerts (write a small test).
- [ ] No secrets in git history; all keys via env.
- [ ] Dashboard chrome i18n in en/th/zh-CN; alert content in all 5 languages.
- [ ] README includes: product story, architecture diagram (mermaid), Phase-2 roadmap (IoT river sensors via Harvest Hub, WeChat/Zalo, SMS, live MRC/TMD feeds), and screenshots for the competition proposal.

---

**Working instruction to Claude Code:** read this entire file first. Then execute Day 1 of §13. At the end of each day's scope, run the relevant acceptance checks and stop for review before continuing. Ask before adding any dependency not listed in §2. When blocked >30 minutes on anything external, mock it and keep moving.
