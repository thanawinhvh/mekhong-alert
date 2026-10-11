-- Lets seed.py upsert gauge_readings idempotently (Day 2).
alter table gauge_readings
  add constraint gauge_readings_station_time_unique unique (station, reading_at);
