create table if not exists cb_promocodes (
	id bigserial NOT NULL PRIMARY KEY,
	promocode text NOT NULL,
    description text,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    valid_from timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    valid_to timestamptz NOT NULL
);

create table if not exists cb_promocodes_users (
	id bigserial NOT NULL PRIMARY KEY,
	promocode_id bigint NOT NULL,
	user_id bigint NOT NULL,
    used_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT cb_promocodes_users__promocode_id FOREIGN KEY (promocode_id) REFERENCES cb_promocodes(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT cb_promocodes_users__user_id FOREIGN KEY (user_id) REFERENCES cb_users(id) ON DELETE CASCADE ON UPDATE CASCADE
);

create table if not exists cb_subscriptions (
	id bigserial NOT NULL PRIMARY KEY,
	user_id bigint NOT NULL,
	period_days int NOT NULL,
	promocode_id bigint NULL DEFAULT NULL,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    activated_at timestamptz NULL DEFAULT NULL,
    CONSTRAINT cb_subscriptions__user_id FOREIGN KEY (user_id) REFERENCES cb_users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT cb_subscriptions__promocode_id FOREIGN KEY (promocode_id) REFERENCES cb_promocodes(id) ON DELETE SET NULL ON UPDATE CASCADE
);

create table if not exists cb_billing_payments (
	id bigserial NOT NULL PRIMARY KEY,
	subscription_id bigint NOT NULL,
	amount decimal(12,2) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    paid_at timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
    refunded_at timestamptz NULL DEFAULT NULL,
    rejected_at timestamptz NULL DEFAULT NULL,
	updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT cb_billing_payments__subscription_id FOREIGN KEY (subscription_id) REFERENCES cb_subscriptions(id) ON DELETE CASCADE ON UPDATE CASCADE
);

create table if not exists cb_billing_payments_notifications (
	id bigserial NOT NULL PRIMARY KEY,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    details json
);