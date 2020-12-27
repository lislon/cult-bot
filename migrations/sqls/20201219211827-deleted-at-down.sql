ALTER TABLE cb_events DROP COLUMN updated_at;
ALTER TABLE cb_events DROP COLUMN deleted_at;

ALTER TABLE cb_events_snapshot DROP COLUMN updated_at;
ALTER TABLE cb_events_snapshot DROP COLUMN deleted_at;