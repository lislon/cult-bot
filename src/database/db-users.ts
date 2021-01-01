import { ColumnSet, IDatabase, IMain } from 'pg-promise'
import { devUsernames } from '../util/admins-list'

interface UserRow {
    username: string
    first_name: string
    last_name: string
    tid: number
    language_code: string
    ua_uuid: string
}

export class UserSaveData {
    username?: string
    first_name?: string
    last_name?: string
    tid: number
    language_code?: string
    ua_uuid?: string
    chat_id: number
    active_at?: Date
    blocked_at?: Date|null
}

export class UserDb {
    id: number
    tid?: number
    ua_uuid: string
    chat_id: number
}

export class UserRepository {
    private readonly columns: ColumnSet

    constructor(private db: IDatabase<any>, private pgp: IMain) {
        this.columns = new pgp.helpers.ColumnSet(
            'username, first_name, last_name, tid, language_code, ua_uuid, chat_id, blocked_at'.split(/,\s*/),
            {table: 'cb_users'}
        );
    }

    public async findUserByTid(tid: number): Promise<UserDb | null> {
        return this.db.oneOrNone<UserDb>('SELECT id, ua_uuid, chat_id FROM cb_users WHERE tid = $1', tid,
            (row: UserDb) => {
                if (row !== null) {
                    row.id = +row.id;
                    row.chat_id = +row.chat_id;
                }
                return row;
            })
    }

    public async findAllDevs(): Promise<UserDb[] | null> {
        return this.db.manyOrNone<UserDb>(`
        SELECT id, ua_uuid, chat_id
        FROM cb_users
        WHERE
         username IN($(devUsernames:csv))
         AND chat_id > 0`,
            {
                devUsernames
            })
    }


    public async insertUser(user: UserSaveData): Promise<number> {
        user.first_name = user.first_name || ''
        user.last_name = user.last_name || ''
        user.username = user.username || ''
        user.language_code = user.language_code || ''
        user.blocked_at = undefined
        const sql = this.pgp.helpers.insert(user, this.columns) + ' returning id'
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

