CREATE TABLE cb_events (
	id bigserial NOT NULL PRIMARY KEY,
	title text NOT NULL,
	category text NOT NULL,
	subcategory text NOT NULL,
	place text NOT NULL,
	address text NOT NULL,
	timetable text NOT NULL,
	duration text NOT NULL,
	price text NOT NULL,
	notes text NOT NULL,
	description text NOT NULL,
	url text NOT NULL,
	tag_level_1 _text NOT NULL,
	tag_level_2 _text NOT NULL,
	tag_level_3 _text NOT NULL,
	rating int4 NOT NULL,
	reviewer text NOT NULL,
	is_anytime bool NOT NULL DEFAULT false,
	geotag text NOT NULL
);
CREATE INDEX cb_events_is_anytime_idx ON cb_events USING btree (is_anytime, category, rating);

CREATE TABLE cb_events_entrance_times (
	id bigserial NOT NULL PRIMARY KEY,
	event_id int8 NOT NULL,
	entrance tstzrange NOT NULL
);
CREATE INDEX cb_events_entrance_times_entrance_idx ON cb_events_entrance_times (entrance);
ALTER TABLE cb_events_entrance_times ADD CONSTRAINT cb_events_entrance_times_fk FOREIGN KEY (event_id) REFERENCES cb_events(id) ON DELETE CASCADE ON UPDATE CASCADE;