ALTER TABLE cb_events DROP COLUMN IF EXISTS popularity;
ALTER TABLE cb_events_snapshot DROP COLUMN IF EXISTS popularity;

ALTER TABLE cb_events_snapshot DROP COLUMN IF EXISTS likes_fake;
ALTER TABLE cb_events_snapshot DROP COLUMN IF EXISTS dislikes_fake;