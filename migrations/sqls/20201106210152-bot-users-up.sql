CREATE TABLE cb_users (
	id bigserial NOT NULL PRIMARY KEY,
	username text NOT NULL DEFAULT '',
	first_name text NOT NULL DEFAULT '',
	last_name text NOT NULL DEFAULT '',
	tid bigint NOT NULL,
	language_code text NOT NULL DEFAULT '',
	created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	active_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	ua_uuid uuid NOT NULL
);

CREATE UNIQUE INDEX cb_users_tid_idx ON cb_users (tid);

-- Column comments

COMMENT ON COLUMN cb_users.ua_uuid IS 'UUID for Google Analytics';
COMMENT ON COLUMN cb_users.language_code IS 'IETF language tag of the users language';
