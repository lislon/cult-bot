import { cleanDb, getMockUser, givenUnpaidSubscription, givenUsers } from './db-test-utils'
import { db, dbCfg } from '../../../src/database/db'
import { PAYMENT_NOTIFICATIONS_TABLE, PAYMENT_TABLE } from '../../../src/database/db-billing'
import { first } from 'lodash'

beforeAll(() => dbCfg.connectionString.includes('test') || process.exit(666))
afterAll(db.$pool.end)

describe('Billing', () => {


    describe('Creating Invoices', () => {

        const amount = 123.45
        let userId = 0
        beforeEach(async () => {
            await cleanDb()
            userId = first(await givenUsers([
                getMockUser({}),
            ]))
        })


        test('create new unpaid invoice', async () => {
            const subscriptionId = await givenUnpaidSubscription(userId)

            const paymentId = await db.repoBilling.createUnpaidPayment({subscriptionId, userId, amount})
            expect(await db.one(`select count(*) from ${PAYMENT_TABLE} where paid_at IS NULL AND id = $1`, paymentId)).toEqual({count: '1'})
        })

        test('findUnpaidSubscription will find last unpaid invoice', async () => {
            const subscriptionId = await givenUnpaidSubscription(userId)
            const paymentId1 = await db.repoBilling.createUnpaidPayment({subscriptionId, userId, amount})
            const paymentId2 = await db.repoBilling.createUnpaidPayment({subscriptionId, userId, amount})

            await db.repoBilling.updatePayment({
                id: paymentId2,
                paidAt: new Date()
            })

            const unpaidSubscription = await db.repoBilling.findUnpaidSubscription({
                amount, days: 10, userId
            })

            expect(unpaidSubscription).toEqual(paymentId1)
        })


        test('mark invoice as paid', async () => {
            const subscriptionId = await givenUnpaidSubscription(userId)

            const paymentId = await db.repoBilling.createUnpaidPayment({subscriptionId, userId: userId, amount})

            await db.repoBilling.updatePayment({
                id: paymentId,
                paidAt: new Date()
            })
            expect(await db.one(`select count(*) from ${PAYMENT_TABLE} where paid_at IS NOT NULL`)).toEqual({count: '1'})
        })
    })

    describe('Tinkoff API', () => {
        test('save notification', async () => {
            await db.repoBilling.savePaymentNotification({
                TerminalKey: '1510572937960',
                OrderId: 'test2',
                Success: true,
                Status: 'CONFIRMED',
                PaymentId: 2006896,
                ErrorCode: '0',
                Amount: 102120,
                CardId: 867911,
                Pan: '430000**0777',
                ExpDate: '1122',
                Token: 'd0815e288f121255d5d6b77831fb486cc5e9f91914a3f58a99b6118b54676d84'
            })
            expect(await db.one(`select count(*) from ${PAYMENT_NOTIFICATIONS_TABLE}`)).toEqual({count: '1'})
        })

    })

})