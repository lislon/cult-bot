DROP INDEX cb_events_search_idx;

CREATE INDEX cb_events_search_idx ON cb_events USING GIN ((
	setweight(to_tsvector('russian', coalesce(title,'')), 'A') ||
	setweight(to_tsvector('russian', coalesce(description,'')), 'D') ||
	setweight(to_tsvector('russian', coalesce(place,'')), 'D') ||
	setweight(to_tsvector('russian',
			REGEXP_REPLACE(REPLACE(cb_join_arr(tag_level_3), '#', ''), '(?<=[а-яa-z])([А-ЯA-Z])', ' \1', 'g')), 'B')
));