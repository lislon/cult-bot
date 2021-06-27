import { db, dbCfg } from '../../../src/database/db'
import { UserSaveData } from '../../../src/database/db-users'
import { MOCK_UUID } from './db-test-utils'

beforeAll(() => dbCfg.connectionString.includes('test') || process.exit(666))
afterAll(db.$pool.end)

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

    test('User is saved as referral', async () => {
        const id = await db.repoUser.insertUser({...user, referral: 'lisa'})

        const dbUser = await db.one('SELECT * FROM cb_users WHERE id = $1', [id])

        expect(dbUser).toMatchObject({
            tid: '1',
            username: 'lislon',
            first_name: 'First',
            last_name: 'Last',
            language_code: '',
            referral: 'lisa'
        })
    })

    test('Find users by id', async () => {
        const id1 = await db.repoUser.insertUser({...user, tid: 1, referral: 'lisa'})
        const id2 = await db.repoUser.insertUser({...user, tid: 2, referral: 'lisa2'})
        const users = await db.repoUser.findUsersByIds([id1, id2])

        expect(users).toMatchObject([
            {
                id: id1,
                tid: 1,
                username: 'lislon',
                first_name: 'First',
                last_name: 'Last'
            },
            {
                id: id2,
                tid: 2,
                username: 'lislon',
                first_name: 'First',
                last_name: 'Last'
            }])
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
