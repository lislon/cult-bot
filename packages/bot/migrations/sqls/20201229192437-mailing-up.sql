ALTER TABLE cb_users ADD COLUMN IF NOT EXISTS blocked_at timestamptz NULL;
ALTER TABLE cb_users ADD COLUMN IF NOT EXISTS mailings_count int NOT NULL DEFAULT 0;