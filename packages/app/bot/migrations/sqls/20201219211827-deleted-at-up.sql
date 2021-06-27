ALTER TABLE cb_events ADD updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE cb_events ADD deleted_at timestamptz NULL;

ALTER TABLE cb_events_snapshot ADD updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE cb_events_snapshot ADD deleted_at timestamptz NULL;