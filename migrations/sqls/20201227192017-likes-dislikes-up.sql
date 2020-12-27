ALTER TABLE cb_users DROP COLUMN chat_id;
ALTER TABLE cb_users ADD blocked_at timestamptz NULL DEFAULT NULL;
ALTER TABLE cb_users ADD events_liked _int8 NOT NULL DEFAULT '{}'::bigint[];
ALTER TABLE cb_users ADD events_disliked _int8 NOT NULL DEFAULT '{}'::bigint[];
ALTER TABLE cb_users ADD events_favorite _int8 NOT NULL DEFAULT '{}'::bigint[];
