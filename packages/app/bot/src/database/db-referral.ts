import { ColumnSet, IDatabase, IMain } from 'pg-promise'
import { fieldStr, fieldTimestamptzNullable } from '@culthub/pg-utils'

export interface Referral {
    code: string
    gaSource: string
    redirect: string
    description: string
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
    id: number
    gaSource: string
    description: string
    redirect: string
}

export class ReferralRepository {
    private readonly columns: ColumnSet

    constructor(private db: IDatabase<unknown>, private pgp: IMain) {
        this.columns = new pgp.helpers.ColumnSet([
                fieldStr('code'),
                fieldStr('ga_source'),
                fieldStr('redirect'),
                fieldStr('description'),
                fieldTimestamptzNullable('published_at'),
                fieldTimestamptzNullable('deleted_at'),
            ],
            {table: 'cb_referrals'}
        )
    }

    public async loadByCode(code: string): Promise<ReferralInfo> {
        return this.db.oneOrNone('' +
            'SELECT id, ga_source, redirect, description ' +
            'FROM cb_referrals ' +
            'WHERE code = $(code)',
            {code},
            (row: Partial<ReferralDb & { id: number }> | null) => {
                if (row !== null) {
                    return {
                        id: +row.id,
                        gaSource: row.ga_source,
                        redirect: row.redirect,
                        description: row.description
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
            description: referral.description,
            published_at: undefined,
            deleted_at: undefined
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
                ORDER BY r.id ASC
                `, undefined, (row: ReferralDbStats) => {
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

