CREATE TABLE p_events (
	id bigserial NOT NULL PRIMARY KEY,
	ext_id text NOT NULL,
	title text NOT NULL,
	category text NOT NULL,
	timetable text NOT NULL,
	place text NOT NULL,
	description text NOT NULL,
	tags _text NOT NULL,
	url text NOT NULL,
	parse_url text NOT NULL,
	updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	deleted_at timestamptz NULL
);

