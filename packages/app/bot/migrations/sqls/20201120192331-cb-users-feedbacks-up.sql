CREATE TABLE cb_feedbacks (
	id bigserial NOT NULL,
	user_id bigserial NOT NULL,
	feedback_text text NOT NULL DEFAULT ''::text,
	message_id bigint NOT NULL,
	created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT cb_feedbacks_pkey PRIMARY KEY (id)
);

ALTER TABLE cb_feedbacks ADD CONSTRAINT cb_feedbacks_fk FOREIGN KEY (user_id) REFERENCES cb_users(id) ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE cb_survey (
	id bigserial NOT NULL,
	user_id bigserial NOT NULL,
	answers jsonb NOT NULL,
	created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT cb_survey_fk FOREIGN KEY (user_id) REFERENCES cb_users(id) ON DELETE CASCADE ON UPDATE CASCADE
);
