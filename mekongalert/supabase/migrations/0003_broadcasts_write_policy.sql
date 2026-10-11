-- 0001_init.sql only added a read policy for broadcasts; the broadcast
-- endpoint inserts via the caller's JWT (RLS-enforced), so it needs a write
-- policy scoped the same way as alert_translations_write.
create policy broadcasts_write on broadcasts for insert with check (
  exists (
    select 1 from alerts a where a.id = broadcasts.alert_id
    and a.tenant_id = (select tenant_id from profiles where id = auth.uid())
  )
);
