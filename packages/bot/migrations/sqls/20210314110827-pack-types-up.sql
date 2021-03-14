ALTER TABLE cb_events_packs ADD COLUMN hide_if_less_then int4 NOT NULL DEFAULT 4;

COMMENT ON COLUMN cb_events_packs.hide_if_less_then IS 'Minimum active events to make pack visible';