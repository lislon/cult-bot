create table cb_referrals (
	id bigserial NOT NULL PRIMARY KEY,
	code text NOT NULL,
	ga_source text NOT NULL DEFAULT '',
	description text NOT NULL DEFAULT '',
	redirect text NOT NULL DEFAULT '',
	published_at timestamptz NULL,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at timestamptz NULL,
    UNIQUE(code),
    UNIQUE(ga_source)
);