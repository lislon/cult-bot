import { db, dbCfg } from '../../../src/database/db'
import { Referral } from '../../../src/database/db-referrals'

beforeAll(() => dbCfg.connectionString.includes('test') || process.exit(666))
afterAll(db.$pool.end);

describe('Referrals', () => {

    const referral: Referral = {
        code: 'a1',
        gaSource: 'A',
        redirect: 'P1'
    }

    beforeEach(async () => await db.none('DELETE FROM cb_referrals'))

    test('Referral can be found', async () => {
        await db.repoReferrals.add(referral)

        const gaSource = await db.repoReferrals.loadByCode('a1')
        expect(gaSource).toMatchObject({
            gaSource: 'A',
            redirect: 'P1'
        });
    })

    test('Not found referral is undefined', async () => {
        const referral = await db.repoReferrals.loadByCode('b1')
        expect(referral).toStrictEqual(undefined);
    })
})
