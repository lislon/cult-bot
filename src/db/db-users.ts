import { ColumnSet, IDatabase, IMain } from 'pg-promise'

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
}

export class UserDb {
    id: number
    ua_uuid: string
}

export class UserRepository {
    private readonly columns: ColumnSet

    constructor(private db: IDatabase<any>, private pgp: IMain) {
        this.columns = new pgp.helpers.ColumnSet(
            'username, first_name, last_name, tid, language_code, ua_uuid'.split(/,\s*/),
            { table: 'cb_users' }
        );
    }

    public async findUserByTid(tid: number): Promise<UserDb|null> {
        return this.db.oneOrNone('SELECT id, ua_uuid FROM cb_users WHERE tid = $1', tid)
    }

    public async insertUser(user: UserSaveData): Promise<number> {
        user.first_name = user.first_name || ''
        user.last_name = user.last_name || ''
        user.username = user.username || ''
        user.language_code = user.language_code || ''
        const sql = this.pgp.helpers.insert(user, this.columns) + ' returning id'
        return +(await this.db.one(sql))['id']
    }
}

