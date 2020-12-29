import { db, dbCfg } from '../../../src/database/db'
import { UserSaveData } from '../../../src/database/db-users'
import { MOCK_UUID } from './db-test-utils'

beforeAll(() => dbCfg.connectionString.includes('test') || process.exit(666))
afterAll(db.$pool.end);

describe('Users', () => {

    const user: UserSaveData = {
        username: 'lislon',
        tid: 1,
        language_code: '',
        last_name: 'Last',
        first_name: 'First',
        ua_uuid: MOCK_UUID
    }

    beforeEach(async () => await db.none('DELETE FROM cb_users'))

    test('User is saved', async () => {
        const id = await db.repoUser.insertUser(user)

        const dbUser = await db.one('SELECT * FROM cb_users WHERE id = $1', [id])

        expect(dbUser).toMatchObject({
            tid: '1',
            username: 'lislon',
            first_name: 'First',
            last_name: 'Last',
            language_code: ''
        })
    })

    test('Null will not be a problem', async () => {
        await db.repoUser.insertUser({
            ...user,
            first_name: undefined
        } as any)
    })

    test('findUser works', async () => {
        await db.repoUser.insertUser(user)
        const userFromDb = await db.repoUser.findUserByTid(user.tid)
        expect(userFromDb.ua_uuid).toEqual(user.ua_uuid)
    })


})
