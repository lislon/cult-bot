import { db, dbCfg } from '../../../src/database/db'
import { cleanDb, getMockUser, givenUsers } from '../../functional/db/db-test-utils'
import { tinkoffStatusUpdate } from '../../../src/api-external-server/service/tinkoff-service'
import { PAYMENT_NOTIFICATIONS_TABLE } from '../../../src/database/db-billing'
import { first } from 'lodash'
import { createBill } from '../../../src/api-server/service/billing-service'
import { encodeBillToken } from '../../../src/lib/subscription/subscription'
import { makeTinkoffNotification } from '../test-util/tinkoff-test-util'
import { CreatePaymentResponse } from '@culthub/interfaces'

beforeAll(() => dbCfg.connectionString.includes('test') || process.exit(666))
afterAll(db.$pool.end)

const priceGenerator = () => 123.14

describe('Payment notifications service layer', () => {
    let userId = 0
    const days = 10
    const billCreatedAt = new Date()
    const now = new Date()

    beforeEach(async () => {
        await cleanDb()
        userId = first(await givenUsers([
            getMockUser({}),
        ]))
    })

    test('payment notification is saved even if its not paid', async () => {
        const result = await tinkoffStatusUpdate(makeTinkoffNotification())
        expect(result).toEqual(`Order '123' is not found`)
        expect(await db.one(`select count(*) from ${PAYMENT_NOTIFICATIONS_TABLE}`)).toEqual({count: '1'})
    })

    describe('Given bill', () => {

        let bill: CreatePaymentResponse = undefined

        beforeEach(async () => {
            bill = await createBill({
                token: encodeBillToken({userId, days})
            }, priceGenerator, billCreatedAt)
        })

        test('SUCCESS notification will activate subscription', async () => {
            const result = await tinkoffStatusUpdate(makeTinkoffNotification({
                OrderId: `${bill.paymentId}`,
                Amount: bill.amount
            }), now)

            expect(result).toEqual(true)
            expect(await db.repoSubscription.getSubscriptions(userId)).toEqual([{
                activatedAt: now,
                createdAt: billCreatedAt,
                id: 1,
                userId
            }])
        }, 100000)

        test('SUCCESS notification will mark payment as paid', async () => {
            const result = await tinkoffStatusUpdate(makeTinkoffNotification({
                OrderId: `${bill.paymentId}`,
                Amount: bill.amount
            }), now)
            const payments = await db.repoBilling.listAllPayments({userId})

            expect(result).toEqual(true)
            expect(payments).toEqual([
                {
                    amount: bill.amount,
                    id: bill.paymentId,
                    paidAt: now,
                    refundedAt: undefined,
                    rejectedAt: undefined,
                    subscriptionId: 1
                }
            ])
        }, 100000)

        test('REJECTED will update rejectAt field', async () => {
            const result = await tinkoffStatusUpdate(makeTinkoffNotification({
                Status: 'REJECTED',
                Success: false,
                OrderId: `${bill.paymentId}`,
                Amount: bill.amount
            }), now)
            expect(result).toEqual(true)
            expect(await db.repoBilling.listAllPayments({userId})).toEqual([
                {
                    amount: bill.amount,
                    id: bill.paymentId,
                    paidAt: undefined,
                    refundedAt: undefined,
                    rejectedAt: now,
                    subscriptionId: 1
                }
            ])
        })

        test('AUTHORIZED will return false if sum is wrong', async () => {
            const result = await tinkoffStatusUpdate(makeTinkoffNotification({
                Status: 'AUTHORIZED',
                Success: false,
                OrderId: `${bill.paymentId}`,
                Amount: 500.0
            }), now)

            expect(result).toEqual('Payment amount mismatch. (Paid 500, but should 123.14)')
        })

        test('REFUND will be recorded, but subscription will stay active', async () => {
            const result1 = await tinkoffStatusUpdate(makeTinkoffNotification({
                Status: 'CONFIRMED',
                OrderId: `${bill.paymentId}`,
                Amount: bill.amount
            }), now)

            const result2 = await tinkoffStatusUpdate(makeTinkoffNotification({
                Status: 'REFUNDED',
                OrderId: `${bill.paymentId}`,
                Amount: bill.amount
            }), now)

            expect(result1).toEqual(true)
            expect(result2).toEqual(true)
            expect(await db.repoBilling.listAllPayments({userId})).toEqual([
                {
                    amount: bill.amount,
                    id: bill.paymentId,
                    paidAt: now,
                    refundedAt: now,
                    rejectedAt: undefined,
                    subscriptionId: 1
                }
            ])
            expect(await db.repoSubscription.getSubscriptions(userId)).toEqual([{
                activatedAt: now,
                createdAt: billCreatedAt,
                id: 1,
                userId
            }])
        })
    })
})
