ALTER TABLE cb_events ADD COLUMN order_rnd INT DEFAULT 0;

update cb_events set order_rnd = CEIL(random() * 1000000);