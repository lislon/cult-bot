import { cleanDb, getMockUser, givenUsers } from './db-test-utils'
import { db, dbCfg } from '../../../src/database/db'

beforeAll(() => dbCfg.connectionString.includes('test') || process.exit(666))
afterAll(db.$pool.end)

describe('Subscription', () => {
    let userId = 0
    const createdAt = new Date()
    const activatedAt = new Date(2021, 1, 1)

    beforeEach(async () => {
        await cleanDb()
        const [id] = await givenUsers([
            getMockUser({}),
        ])
        userId = id
    })

    test('create inactive subscription', async () => {
        const subscriptionId = await db.repoSubscription.createSubscription({
            createdAt,
            periodDays: 10,
            userId
        })
        const subscriptions = await db.repoSubscription.getSubscriptions(userId)

        expect(subscriptions).toEqual([{
            id: subscriptionId,
            userId: userId,
            activatedAt: undefined,
            createdAt
        }])
    })

    test('activate inactive subscription', async () => {
        const subscriptionId = await db.repoSubscription.createSubscription({
            createdAt,
            periodDays: 10,
            userId
        })
        const isActivated = await db.repoSubscription.updateSubscription({subscriptionId, activatedAt})

        const subscriptions = await db.repoSubscription.getSubscriptions(userId)
        expect(subscriptions).toEqual([{
            id: subscriptionId,
            userId: userId,
            activatedAt,
            createdAt
        }])
        expect(isActivated).toBeTruthy()
    })
})