ALTER TABLE cb_events_packs ADD ext_id text NOT NULL DEFAULT '';
ALTER TABLE cb_events_packs ADD updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE cb_events_packs ADD deleted_at timestamptz NULL;

UPDATE cb_events_packs SET ext_id = CONCAT('temp-', id);
CREATE UNIQUE INDEX cb_events_packs_ext_id_idx ON cb_events_packs (ext_id);