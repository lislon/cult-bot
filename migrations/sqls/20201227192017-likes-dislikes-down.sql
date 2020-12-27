ALTER TABLE cb_users ADD chat_id int8 NOT NULL DEFAULT 0;
ALTER TABLE cb_users DROP COLUMN blocked_at timestamptz;
ALTER TABLE cb_users DROP COLUMN events_liked _int8;
ALTER TABLE cb_users DROP COLUMN events_disliked _int8;
ALTER TABLE cb_users DROP COLUMN events_favorite _int8;
