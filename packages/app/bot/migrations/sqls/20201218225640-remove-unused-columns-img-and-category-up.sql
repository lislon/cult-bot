ALTER TABLE cb_events DROP COLUMN IF EXISTS subcategory;
ALTER TABLE cb_events_snapshot DROP COLUMN IF EXISTS subcategory;

ALTER TABLE cb_events_packs DROP COLUMN IF EXISTS image;
ALTER TABLE cb_events_packs DROP COLUMN IF EXISTS image_src;