ALTER TABLE cb_users ADD chat_id int8 NOT NULL DEFAULT 0;

ALTER TABLE cb_feedbacks ADD admin_chat_id bigint NOT NULL DEFAULT 0;
COMMENT ON COLUMN cb_feedbacks.admin_chat_id IS 'Admin feedback chat id';
ALTER TABLE cb_feedbacks ADD admin_message_id bigint NOT NULL DEFAULT 0;
COMMENT ON COLUMN cb_feedbacks.admin_message_id IS 'Message of feedback in admin feedback chat';