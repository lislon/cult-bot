ALTER TABLE cb_events ADD ext_id text NOT NULL DEFAULT '';
COMMENT ON COLUMN cb_events.ext_id IS 'External event reference';
UPDATE cb_events SET ext_id = CONCAT('temp-', id);
CREATE UNIQUE INDEX cb_events_ext_id_idx ON cb_events (ext_id);


create table cb_events_snapshot as (select * from cb_events) with no data;
