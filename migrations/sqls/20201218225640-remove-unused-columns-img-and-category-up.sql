ALTER TABLE cb_events DROP COLUMN subcategory;
ALTER TABLE cb_events_snapshot DROP COLUMN subcategory;

ALTER TABLE cb_events_packs DROP COLUMN image;
ALTER TABLE cb_events_packs DROP COLUMN image_src;