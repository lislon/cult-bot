DROP INDEX IF EXISTS cb_events_entrance_times_entrance_idx;
CREATE INDEX cb_events_entrance_times_entrance_idx ON cb_events_entrance_times USING btree(entrance)

DROP INDEX IF EXISTS cb_events_tag_level1_idx;
DROP INDEX IF EXISTS cb_events_tag_level2_idx;

