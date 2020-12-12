CREATE TABLE cb_events_packs (
	id bigserial NOT NULL PRIMARY KEY,
	title text NOT NULL,
	description text NOT NULL DEFAULT '',
	author text NOT NULL DEFAULT '',
	image bytea,
	image_src text NOT NULL DEFAULT '',
    event_ids int8[] NOT NULL DEFAULT '{}',
    weight int8 NOT NULL DEFAULT 0,
	created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);