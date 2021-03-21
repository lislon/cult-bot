import { ColumnSet, IDatabase, IMain } from 'pg-promise'
import { fieldInt, fieldInt8Array, fieldStr, fieldTimestamptzNullable } from '@culthub/pg-utils'

export interface UserSaveData {
    username?: string
    first_name?: string
    last_name?: string
    tid: number
    language_code?: string
    ua_uuid?: string
    active_at?: Date
    blocked_at?: Date
    events_liked?: number[]
    events_disliked?: number[]
    events_favorite?: number[]
    clicks?: number
    referral?: string
}


export interface UserIds {
    id: number
    tid: number
}

export interface UserForRead extends UserIds{
    username?: string
    first_name?: string
    last_name?: string
    language_code?: string
    ua_uuid: string
    blocked_at?: Date|null
    events_liked?: number[]
    events_disliked?: number[]
    events_favorite: number[]
    clicks?: number
}


export interface UserDb extends UserForRead {
    referral: string
}

export class UserRepository {
    private readonly columns: ColumnSet

    constructor(private db: IDatabase<unknown>, private pgp: IMain) {
        this.columns = new pgp.helpers.ColumnSet([
            fieldStr('username'),
            fieldStr('first_name'),
            fieldStr('last_name'),
            fieldInt('tid'),
            fieldStr('language_code'),
            fieldStr('ua_uuid'),
            fieldTimestamptzNullable('blocked_at'),
            fieldInt8Array('events_liked'),
            fieldInt8Array('events_disliked'),
            fieldInt8Array('events_favorite'),
            fieldInt('clicks'),
            fieldStr('referral'),
        ],
            {table: 'cb_users'}
        );
    }

    public async findUserByTid(tid: number): Promise<UserForRead | null> {
        return this.db.oneOrNone<UserForRead>('SELECT id, tid, ua_uuid, events_favorite, clicks FROM cb_users WHERE tid = $1', tid,
            (row: UserForRead) => {
                if (row !== null) {
                    return {
                        id: +row.id,
                        tid: +row.tid,
                        ua_uuid: row.ua_uuid,
                        clicks: +(row.clicks || 0),
                        events_favorite: row.events_favorite || []
                    }
                }
                return row
            })
    }

    public async findUsersByUsernamesOrIds(usernames: string[], tids: number[] = []): Promise<({tid: number, ua_uuid: number})[]> {
        return this.db.map(`
        SELECT tid, ua_uuid
        FROM cb_users
        WHERE
         username IN($(usernames:csv)) OR tid IN($(tids:csv))`,
            {
                usernames,
                tids
            }, row => {
                return {
                    tid: +row.tid,
                    ua_uuid: row.ua_uuid
                }
            })
    }


    public async insertUser(user: UserSaveData): Promise<number> {
        const rawData: Omit<UserDb, 'id'> = {
            first_name: user.first_name || '',
            last_name: user.last_name || '',
            username: user.username || '',
            language_code: user.language_code || '',
            tid: user.tid,
            ua_uuid: user.ua_uuid || '',
            clicks: 0,
            events_liked: [],
            events_favorite: [],
            events_disliked: [],
            blocked_at: undefined,
            referral: user.referral || ''
        }
        const sql = this.pgp.helpers.insert(rawData, this.columns) + ' returning id'
        return +(await this.db.one(sql))['id']
    }

    public async updateUser(id: number, data: Partial<UserSaveData>): Promise<void> {
        const sql = this.pgp.helpers.update(data, undefined, 'cb_users') + this.pgp.as.format(' WHERE id = ${id}')
        await this.db.none(sql, {id})
    }

    public async listUsersForMailing(maxMailingsCount: number): Promise<Pick<UserDb, 'id'|'ua_uuid'|'tid'>[]> {
        return await this.db.map(`
                SELECT id, tid, ua_uuid
                FROM cb_users
                WHERE blocked_at IS NULL AND mailings_count < $(maxMailingsCount) AND mailings_count >= 0`, {
            maxMailingsCount,
        }, (row) => {
            return {
                id: +row.id,
                tid: +row.tid,
                ua_uuid: row.ua_uuid
            }
        })
    }

    public async markAsBlocked(userIds: number[], date: Date): Promise<void> {
        if (userIds.length === 0) return
        await this.db.none('UPDATE cb_users SET blocked_at = $(date) WHERE id IN ($(userIds:csv))', {
            date,
            userIds
        })
    }

    public async incrementMailingCounter(userIds: number[]): Promise<void> {
        if (userIds.length === 0) return
        await this.db.none('UPDATE cb_users SET mailings_count = mailings_count + 1 WHERE id IN ($(userIds:csv))', {
            userIds
        })
    }

    public async resetMailingCounter(): Promise<void> {
        await this.db.none('UPDATE cb_users SET mailings_count = 0')
    }


}

