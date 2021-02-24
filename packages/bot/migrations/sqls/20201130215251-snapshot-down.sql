ALTER TABLE cb_events DROP COLUMN IF EXISTS ext_id;
ALTER TABLE cb_events DROP COLUMN IF EXISTS created_at;

DROP TABLE IF EXISTS cb_events_snapshot;