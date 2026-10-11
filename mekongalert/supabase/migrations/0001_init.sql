-- MekongAlert — initial schema (§5 of SPEC.md) + RLS
-- Tenant-scoped pattern: every table keyed (directly or via join) to tenants.id.
-- Cross-tenant visibility only through alert_shares.

-- ── Tables ──────────────────────────────────────────────────────────────

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

-- ── Row Level Security ──────────────────────────────────────────────────
-- Helper pattern used throughout: (select tenant_id from profiles where id = auth.uid())
-- resolves the caller's own tenant. profiles is readable only for the caller's
-- own row, so this subquery never leaks other users' tenant assignment.

alter table tenants enable row level security;
create policy tenant_self_read on tenants for select using (
  id = (select tenant_id from profiles where id = auth.uid())
);

alter table profiles enable row level security;
create policy profile_self_read on profiles for select using (id = auth.uid());

alter table areas enable row level security;
create policy areas_tenant_read on areas for select using (
  tenant_id = (select tenant_id from profiles where id = auth.uid())
);

alter table alerts enable row level security;
create policy alerts_tenant_read on alerts for select using (
  tenant_id = (select tenant_id from profiles where id = auth.uid())
  or id in (select alert_id from alert_shares
            where to_tenant = (select tenant_id from profiles where id = auth.uid()))
);
create policy alerts_tenant_write on alerts for insert with check (
  tenant_id = (select tenant_id from profiles where id = auth.uid())
);
create policy alerts_tenant_update on alerts for update using (
  tenant_id = (select tenant_id from profiles where id = auth.uid())
);

alter table alert_translations enable row level security;
create policy alert_translations_read on alert_translations for select using (
  exists (
    select 1 from alerts a where a.id = alert_translations.alert_id
    and (a.tenant_id = (select tenant_id from profiles where id = auth.uid())
         or a.id in (select alert_id from alert_shares
                     where to_tenant = (select tenant_id from profiles where id = auth.uid())))
  )
);
create policy alert_translations_write on alert_translations for all using (
  exists (
    select 1 from alerts a where a.id = alert_translations.alert_id
    and a.tenant_id = (select tenant_id from profiles where id = auth.uid())
  )
) with check (
  exists (
    select 1 from alerts a where a.id = alert_translations.alert_id
    and a.tenant_id = (select tenant_id from profiles where id = auth.uid())
  )
);

alter table alert_shares enable row level security;
create policy alert_shares_read on alert_shares for select using (
  from_tenant = (select tenant_id from profiles where id = auth.uid())
  or to_tenant = (select tenant_id from profiles where id = auth.uid())
);
create policy alert_shares_write on alert_shares for insert with check (
  from_tenant = (select tenant_id from profiles where id = auth.uid())
);

alter table broadcasts enable row level security;
create policy broadcasts_read on broadcasts for select using (
  exists (
    select 1 from alerts a where a.id = broadcasts.alert_id
    and (a.tenant_id = (select tenant_id from profiles where id = auth.uid())
         or a.id in (select alert_id from alert_shares
                     where to_tenant = (select tenant_id from profiles where id = auth.uid())))
  )
);

-- subscribers, citizen_reports, gauge_readings: RLS enabled, no policies for
-- anon/authenticated roles. Accessed only via the FastAPI service-role key,
-- which tenant-scopes citizen_reports in application code (see §6.4/§11).
alter table subscribers enable row level security;
alter table citizen_reports enable row level security;
alter table gauge_readings enable row level security;
