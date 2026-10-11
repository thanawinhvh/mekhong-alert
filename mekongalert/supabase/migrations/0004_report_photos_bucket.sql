-- §2/§6.4 — citizen report photos. Public read (disaster photos aren't
-- sensitive); all writes go through the service role (LINE webhook), which
-- bypasses RLS/storage policies anyway.
insert into storage.buckets (id, name, public)
values ('report-photos', 'report-photos', true)
on conflict (id) do nothing;
