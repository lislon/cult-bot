import { ColumnSet, IDatabase, IMain } from 'pg-promise'
import { fieldStr, fieldTimestamptzNullable } from '@culthub/pg-utils'

export interface Referral {
    code: string
    gaSource: string
    redirect: string
}

export interface ReferralDesc {
    code: string
    gaSource: string
    description: string
    redirect: string
    redirectTitle: string
    usersCount: number
}

export interface ReferralDb {
    code: string
    ga_source: string
    redirect: string
    description: string
    published_at?: string
    deleted_at?: string
}

export interface ReferralDbStats extends ReferralDb {
    redirect_title: string
    users_count: number
}

export interface ReferralInfo {
    gaSource: string
    redirect: string
}

export class ReferralsRepository {
    private readonly columns: ColumnSet

    constructor(private db: IDatabase<unknown>, private pgp: IMain) {
        this.columns = new pgp.helpers.ColumnSet([
            fieldStr('code'),
            fieldStr('ga_source'),
            fieldStr('redirect'),
            fieldTimestamptzNullable('published_at'),
            fieldTimestamptzNullable('deleted_at'),
        ],
            {table: 'cb_referrals'}
        );
    }

    public async loadByCode(code: string): Promise<ReferralInfo> {
        return this.db.oneOrNone('' +
            'SELECT ga_source, redirect ' +
            'FROM cb_referrals ' +
            'WHERE code = $(code)',
            { code },
            (row: Partial<ReferralDb>|null) => {
                if (row !== null) {
                    return {
                        gaSource: row.ga_source,
                        redirect: row.redirect
                    }
                }
                return undefined
            })
    }

    public async add(referral: Referral): Promise<number> {
        const rawData: ReferralDb = {
            code: referral.code,
            ga_source: referral.gaSource,
            redirect: referral.redirect,
            published_at: undefined,
            deleted_at: undefined,
            description: ''
        }
        const sql = this.pgp.helpers.insert(rawData, this.columns) + ' returning id'
        return +(await this.db.one(sql))['id']
    }

    public async list(): Promise<ReferralDesc[]> {
        return await this.db.map(`
                SELECT r.code, r.ga_source, r.redirect, r.description, ce.title AS redirect_title,
                        (SELECT COUNT(u.id) FROM cb_users u WHERE u.referral = r.redirect AND u.referral != '') AS users_count
                FROM cb_referrals r
                LEFT JOIN cb_events ce ON (ce.ext_id = r.redirect)
                WHERE r.deleted_at IS NULL
                ORDER BY r.created_at ASC, code DESC
                `, undefined,(row: ReferralDbStats) => {
            return {
                redirect: row.redirect,
                code: row.code,
                gaSource: row.ga_source,
                description: row.description,
                redirectTitle: row.redirect_title,
                usersCount: row.users_count
            }
        })
    }
}

