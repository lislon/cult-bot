CREATE TABLE cb_events_packs (
	id bigserial NOT NULL PRIMARY KEY,
	title text NOT NULL,
	description text NOT NULL DEFAULT '',
	author text NOT NULL DEFAULT '',
	date_range tstzrange NOT NULL,
	image bytea,
    event_ids int8[] NOT NULL DEFAULT '{}',
	created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
);

CREATE INDEX cb_events_packs_date_range_idx ON cb_events_packs (date_range);