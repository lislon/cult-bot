import { db, dbCfg } from '../../../src/database/db'
import { Referral } from '../../../src/database/db-referral'
import { ReferralVisitData } from '../../../src/database/db-referral-visits'
import { mskMoment } from '../../../src/util/moment-msk'

beforeAll(() => dbCfg.connectionString.includes('test') || process.exit(666))
afterAll(db.$pool.end);

let TEST_USER_ID_A: number = undefined
let TEST_REFERRAL_ID_A: number = undefined

describe('Referral Visit', () => {

    const visitAt = mskMoment('2020-01-01 12:00');

    beforeEach(async () => {
        await db.none('TRUNCATE cb_users, cb_referrals RESTART identity CASCADE')
        TEST_USER_ID_A = await db.repoUser.insertUser({
            tid: 1,
            username: 'lislon',
            ua_uuid: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d'
        })
        TEST_REFERRAL_ID_A = await db.repoReferral.add({
            redirect: '',
            code: 'a1',
            gaSource: 'q1',
            description: ''
        })
    })

    test('Referral visit can be added', async () => {
        await db.repoReferralVisit.insert({
            userId: TEST_USER_ID_A,
            referralId: TEST_REFERRAL_ID_A,
            visitAt: visitAt
        })
    })

    test('Is visit recorded', async () => {
        await db.repoReferralVisit.insert({
            userId: TEST_USER_ID_A,
            referralId: TEST_REFERRAL_ID_A,
            visitAt: visitAt
        })
        expect(await db.repoReferralVisit.isVisitRecordedByUsernameAndGaSource(1, 'q1')).toBeTruthy()
    })

})
