import { db, dbCfg } from '../../../src/database/db'
import { createBill } from '../../../src/api-server/service/billing-service'
import { encodeBillToken } from '../../../src/lib/subscription/subscription'
import { cleanDb, getMockUser, givenUsers } from '../../functional/db/db-test-utils'
import { first } from 'lodash'

beforeAll(() => dbCfg.connectionString.includes('test') || process.exit(666))
afterAll(db.$pool.end)

const priceGenerator = () => 123.14

describe('Create bill', () => {

    let userId = 0
    const days = 10

    beforeEach(async () => {
        await cleanDb()
        userId = first(await givenUsers([
            getMockUser({}),
        ]))
    })

    test('simple bill', async () => {
        const response = await createBill({
            token: encodeBillToken({userId, days})
        }, priceGenerator)
        expect(response).toEqual({
            amount: 123.14,
            description: 'Оплата',
            paymentId: 1
        })
    })

    test('simple bill second time will return first bill', async () => {
        await createBill({
            token: encodeBillToken({userId, days})
        }, priceGenerator)
        const response = await createBill({
            token: encodeBillToken({userId, days})
        }, priceGenerator)
        expect(response).toEqual({
            amount: 123.14,
            description: 'Оплата',
            paymentId: 1
        })
    })
})
