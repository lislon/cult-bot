DROP INDEX IF EXISTS cb_events_entrance_times_entrance_idx;
CREATE INDEX cb_events_entrance_times_entrance_idx ON cb_events_entrance_times USING gist (entrance);

CREATE INDEX cb_events_tag_level1_idx ON cb_events USING gin (tag_level_1);
        CREATE INDEX cb_events_tag_level2_idx ON cb_events USING gin (tag_level_2);

        ANALYSE;