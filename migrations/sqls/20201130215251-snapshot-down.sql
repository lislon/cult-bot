ALTER TABLE cb_events DROP COLUMN ext_id;
ALTER TABLE cb_events DROP COLUMN created_at;

DROP TABLE IF EXISTS cb_events_snapshot;
