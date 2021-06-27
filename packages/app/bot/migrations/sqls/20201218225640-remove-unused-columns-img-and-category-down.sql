ALTER TABLE cb_events ADD COLUMN subcategory text NOT NULL DEFAULT '';
ALTER TABLE cb_events_snapshot ADD COLUMN subcategory text NOT NULL DEFAULT '';

ALTER TABLE cb_events_packs ADD COLUMN image bytea;
ALTER TABLE cb_events_packs ADD COLUMN image_src text NOT NULL DEFAULT '';
