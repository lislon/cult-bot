import { db, dbCfg } from '../../../src/db/db'
import { UserSaveData } from '../../../src/db/db-users'

beforeAll(() => dbCfg.connectionString.includes('test') || process.exit(666))
afterAll(db.$pool.end);

describe('Users', () => {

    const user: UserSaveData = {
        username: 'lislon',
        tid: 1,
        language_code: '',
        last_name: 'Last',
        first_name: 'First',
        ua_uuid: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d'
    }

    beforeEach(async () => await db.none('DELETE FROM cb_users'))

    test('User is saved', async () => {
        const id = await db.userRepo.insertUser(user)

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
        await db.userRepo.insertUser({
            ...user,
            first_name: undefined
        } as any)
    })

    test('findUser works', async () => {
        await db.userRepo.insertUser(user)
        const userFromDb = await db.userRepo.findUserByTid(user.tid)
        expect(userFromDb.ua_uuid).toEqual(user.ua_uuid)
    })


})
