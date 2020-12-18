ALTER TABLE cb_events ADD COLUMN subcategory text NOT NULL DEFAULT '';
ALTER TABLE cb_events_snapshot ADD COLUMN subcategory text NOT NULL DEFAULT '';