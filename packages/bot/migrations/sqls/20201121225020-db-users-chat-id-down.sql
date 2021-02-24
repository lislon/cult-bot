ALTER TABLE cb_users DROP COLUMN IF EXISTS chat_id;
ALTER TABLE cb_feedbacks DROP COLUMN IF EXISTS admin_chat_id;
ALTER TABLE cb_feedbacks DROP COLUMN IF EXISTS admin_message_id;