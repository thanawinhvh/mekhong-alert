-- Day 6.5/6.6 "WOW pack" — additive only, does not touch P0 tables/policies.
-- Visibility pattern for cross-tenant collaboration tables (incident_messages,
-- tasks, impact_assessments) mirrors alert_translations exactly: readable by
-- the owning tenant OR any tenant the alert was shared to.

-- ── W1: Coordination chat ──────────────────────────────────────────────
create table incident_messages (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid not null references alerts(id) on delete cascade,
  tenant_id uuid not null references tenants(id),
  profile_id uuid not null references profiles(id),
  body_original text not null,
  lang_original text not null,
  translations jsonb not null default '{}',
  created_at timestamptz default now()
);

alter table incident_messages enable row level security;
create policy incident_messages_read on incident_messages for select using (
  exists (
    select 1 from alerts a where a.id = incident_messages.alert_id
    and (a.tenant_id = (select tenant_id from profiles where id = auth.uid())
         or a.id in (select alert_id from alert_shares where to_tenant = (select tenant_id from profiles where id = auth.uid())))
  )
);
create policy incident_messages_write on incident_messages for insert with check (
  tenant_id = (select tenant_id from profiles where id = auth.uid())
  and profile_id = auth.uid()
  and exists (
    select 1 from alerts a where a.id = incident_messages.alert_id
    and (a.tenant_id = (select tenant_id from profiles where id = auth.uid())
         or a.id in (select alert_id from alert_shares where to_tenant = (select tenant_id from profiles where id = auth.uid())))
  )
);

-- ── W2: AI SITREP ───────────────────────────────────────────────────────
create table sitreps (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  content_th text not null,
  content_zh text not null,
  generated_by uuid references profiles(id),
  created_at timestamptz default now()
);

alter table sitreps enable row level security;
create policy sitreps_read on sitreps for select using (
  tenant_id = (select tenant_id from profiles where id = auth.uid())
);
create policy sitreps_write on sitreps for insert with check (
  tenant_id = (select tenant_id from profiles where id = auth.uid())
);

-- ── W3: Crowd Signal ────────────────────────────────────────────────────
create table signals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  category text not null,
  report_ids uuid[] not null,
  status text not null default 'new' check (status in ('new','dismissed','converted')),
  created_at timestamptz default now()
);

alter table signals enable row level security;
create policy signals_read on signals for select using (
  tenant_id = (select tenant_id from profiles where id = auth.uid())
);
create policy signals_update on signals for update using (
  tenant_id = (select tenant_id from profiles where id = auth.uid())
);
-- inserts happen via the service role from the LINE webhook (no user JWT context).

-- ── W7: AI Impact Assessment + shelters ─────────────────────────────────
create table shelters (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  name text not null,
  capacity int not null,
  lat double precision not null,
  lng double precision not null,
  created_at timestamptz default now()
);

alter table shelters enable row level security;
create policy shelters_read on shelters for select using (
  tenant_id = (select tenant_id from profiles where id = auth.uid())
);

create table impact_assessments (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid not null references alerts(id) on delete cascade,
  content_th text not null,
  content_zh text not null,
  shelter_recommendations jsonb not null default '[]',
  estimated_affected_population int,
  generated_by uuid references profiles(id),
  created_at timestamptz default now()
);

alter table impact_assessments enable row level security;
create policy impact_assessments_read on impact_assessments for select using (
  exists (
    select 1 from alerts a where a.id = impact_assessments.alert_id
    and (a.tenant_id = (select tenant_id from profiles where id = auth.uid())
         or a.id in (select alert_id from alert_shares where to_tenant = (select tenant_id from profiles where id = auth.uid())))
  )
);
create policy impact_assessments_write on impact_assessments for insert with check (
  exists (
    select 1 from alerts a where a.id = impact_assessments.alert_id
    and a.tenant_id = (select tenant_id from profiles where id = auth.uid())
  )
);

-- areas.population_estimate — rough figures for impact assessment math, not
-- official statistics (labelled as such in the UI).
alter table areas add column population_estimate int;

-- ── W8: Response Task Board ─────────────────────────────────────────────
create table tasks (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid not null references alerts(id) on delete cascade,
  tenant_id uuid not null references tenants(id),
  title text not null,
  assignee text,
  status text not null default 'new' check (status in ('new','doing','done')),
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

alter table tasks enable row level security;
create policy tasks_read on tasks for select using (
  exists (
    select 1 from alerts a where a.id = tasks.alert_id
    and (a.tenant_id = (select tenant_id from profiles where id = auth.uid())
         or a.id in (select alert_id from alert_shares where to_tenant = (select tenant_id from profiles where id = auth.uid())))
  )
);
create policy tasks_write on tasks for insert with check (
  tenant_id = (select tenant_id from profiles where id = auth.uid())
  and exists (
    select 1 from alerts a where a.id = tasks.alert_id
    and (a.tenant_id = (select tenant_id from profiles where id = auth.uid())
         or a.id in (select alert_id from alert_shares where to_tenant = (select tenant_id from profiles where id = auth.uid())))
  )
);
create policy tasks_update on tasks for update using (
  exists (
    select 1 from alerts a where a.id = tasks.alert_id
    and (a.tenant_id = (select tenant_id from profiles where id = auth.uid())
         or a.id in (select alert_id from alert_shares where to_tenant = (select tenant_id from profiles where id = auth.uid())))
  )
);
