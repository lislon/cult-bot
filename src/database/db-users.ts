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
}

export class UserDb {
    id: number
    ua_uuid: string
    chat_id: number
}

export class UserRepository {
    private readonly columns: ColumnSet

    constructor(private db: IDatabase<any>, private pgp: IMain) {
        this.columns = new pgp.helpers.ColumnSet(
            'username, first_name, last_name, tid, language_code, ua_uuid, chat_id'.split(/,\s*/),
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
        const sql = this.pgp.helpers.insert(user, this.columns) + ' returning id'
        return +(await this.db.one(sql))['id']
    }

    public async updateUser(id: number, data: Partial<UserSaveData>): Promise<void> {
        const sql = this.pgp.helpers.update(data, undefined, 'cb_users') + this.pgp.as.format(' WHERE id = ${id}')
        await this.db.none(sql, {id})
    }
}

