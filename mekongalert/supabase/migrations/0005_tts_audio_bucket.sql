-- §2/§6.3 — TTS voice bulletins for village loudspeakers. Public read, same
-- reasoning as report-photos: all writes go through the service role.
insert into storage.buckets (id, name, public)
values ('tts-audio', 'tts-audio', true)
on conflict (id) do nothing;
