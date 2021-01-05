ALTER TABLE cb_users ADD chat_id int8 NOT NULL DEFAULT 0;
ALTER TABLE cb_users DROP COLUMN IF EXISTS blocked_at ;
ALTER TABLE cb_users DROP COLUMN IF EXISTS events_liked;
ALTER TABLE cb_users DROP COLUMN IF EXISTS events_disliked;
ALTER TABLE cb_users DROP COLUMN IF EXISTS events_favorite;
ALTER TABLE cb_users DROP COLUMN IF EXISTS clicks;

ALTER TABLE cb_events DROP COLUMN IF EXISTS likes;
ALTER TABLE cb_events DROP COLUMN IF EXISTS dislikes;
ALTER TABLE cb_events DROP COLUMN IF EXISTS likes_fake;
ALTER TABLE cb_events DROP COLUMN IF EXISTS dislikes_fake;

ALTER TABLE cb_events_snapshot ADD COLUMN IF NOT EXISTS order_rnd INT DEFAULT 0;