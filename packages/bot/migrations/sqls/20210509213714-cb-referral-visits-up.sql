CREATE TABLE cb_referral_visits (
	id bigserial NOT NULL PRIMARY KEY,
	user_id bigint NOT NULL,
	referral_id bigint NOT NULL,
	visit_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT cb_referral_visits_user_id_fk FOREIGN KEY (user_id) REFERENCES cb_users(id) ON DELETE CASCADE ON UPDATE CASCADE,
	CONSTRAINT cb_referral_visits_referral_id_fk FOREIGN KEY (referral_id) REFERENCES cb_referrals(id) ON DELETE CASCADE ON UPDATE CASCADE
);

begin;
insert into cb_referral_visits(user_id, referral_id, visit_at)
    select cu.id AS user_id, cr.id AS referral_id, cu.created_at AS visit_at
    from cb_users cu
    join cb_referrals cr on (cu.referral  = cr.ga_source )
    where referral != '';
commit;
