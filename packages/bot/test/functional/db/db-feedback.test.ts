import { db, dbCfg } from '../../../src/database/db'

let TEST_USER_ID_A: number = undefined
let TEST_USER_ID_B: number = undefined
let TEST_USER_ID_C: number = undefined

beforeAll(() => dbCfg.connectionString.includes('test') || process.exit(666))
afterAll(db.$pool.end);

beforeAll(async () => {
    await db.query('DELETE FROM cb_users')
    TEST_USER_ID_A = await db.repoUser.insertUser({
        tid: 1,
        ua_uuid: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d'
    })
    TEST_USER_ID_B = await db.repoUser.insertUser({
        tid: 2,
        ua_uuid: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6a'
    })
    TEST_USER_ID_C = await db.repoUser.insertUser({
        tid: 3,
        ua_uuid: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6b'
    })
})

describe('Survey', () => {

    beforeEach(async () => {
        await db.query('DELETE FROM cb_survey')
    })

    test('Survey is inserted', async () => {
        await db.repoFeedback.saveQuiz({
            userId: TEST_USER_ID_A,
            isFound: true,
            what_is_important: ['price']
        })

        await db.repoFeedback.saveQuiz({
            userId: TEST_USER_ID_A,
            isFound: false,
            why_not_like: ['opt_poor_navigation']
        })

        await db.repoFeedback.saveQuiz({
            userId: TEST_USER_ID_B,
            isFound: true,
            what_is_important: ['area']
        })

        await db.repoFeedback.saveQuiz({
            userId: TEST_USER_ID_C,
            isFound: true,
            what_is_important: ['area', 'price']
        })

        const stats = await db.repoFeedback.getQuizStats()
        expect(JSON.parse(stats)).toStrictEqual({
            'what_is_important': {
                'area': 2,
                'price': 1,
            },
            'why_not_like': {
                'opt_poor_navigation': 1
            }
        })
    })

})
