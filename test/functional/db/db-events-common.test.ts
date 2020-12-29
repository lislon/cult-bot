import { cleanDb, getMockEvent, getMockUser, givenUsers, syncEventsDb4Test } from './db-test-utils'
import { db, dbCfg } from '../../../src/database/db'
import { mkInterval } from '../../lib/timetable/test-utils'
import { mskMoment } from '../../../src/util/moment-msk'

beforeAll(() => dbCfg.connectionString.includes('test') || process.exit(666))
afterAll(db.$pool.end);

describe('Events common', () => {
    const eventTime = [mskMoment('2020-01-01 12:00'), mskMoment('2020-01-03 15:00')]
    const eventTimeOutRange = [mskMoment('2022-01-01 12:00'), mskMoment('2022-01-03 15:00')]
    const yearRange = mkInterval('[2020-01-01 00:00, 2021-01-02 00:00)')

    beforeEach(async () => {
        await cleanDb()
    })

    test('count events on nearest date', async () => {
        await syncEventsDb4Test([
            getMockEvent({title: 'A', eventTime}),
            getMockEvent({title: 'B', eventTime: eventTimeOutRange}),
        ])
        const count = await db.repoEventsCommon.countEvents({
            interval: yearRange
        })
        expect(count).toEqual(1)
    })

    describe('likes', () => {
        let eventId: number
        let userId: number

        beforeEach(async () => {
            const [ eventId1 ] = await syncEventsDb4Test([
                getMockEvent({title: 'A', eventTime}),
            ])

            const [ userId1 ] = await givenUsers([
                getMockUser({ }),
            ])
            eventId = eventId1
            userId = userId1
        })

        test('empty -> like', async () => {
            const { plusLikes, plusDislikes } = await db.repoEventsCommon.voteEvent(userId, eventId, 'like')
            expect({ plusLikes, plusDislikes }).toStrictEqual({ plusLikes: 1, plusDislikes: 0 })
        }, 50000000)

        test('empty -> dislike', async () => {
            const {plusLikes, plusDislikes} = await db.repoEventsCommon.voteEvent(userId, eventId, 'dislike')
            const likesDislikes = await db.repoEventsCommon.getLikesDislikes(eventId)

            expect({plusLikes, plusDislikes}).toStrictEqual({plusLikes: 0, plusDislikes: 1})
            expect(likesDislikes).toStrictEqual([0, 1])
        }, 50000000)

        test('like -> like', async () => {
            await db.repoEventsCommon.voteEvent(userId, eventId, 'like')
            const {plusLikes, plusDislikes} = await db.repoEventsCommon.voteEvent(userId, eventId, 'like')
            const likesDislikes = await db.repoEventsCommon.getLikesDislikes(eventId)
            expect({plusLikes, plusDislikes}).toStrictEqual({plusLikes: -1, plusDislikes: 0})
            expect(likesDislikes).toStrictEqual([0, 0])
        }, 50000000)

        test('like -> dislike -> dislike', async () => {
            await db.repoEventsCommon.voteEvent(userId, eventId, 'like')
            await db.repoEventsCommon.voteEvent(userId, eventId, 'dislike')
            await db.repoEventsCommon.voteEvent(userId, eventId, 'dislike')
            const likesDislikes = await db.repoEventsCommon.getLikesDislikes(eventId)
            expect(likesDislikes).toStrictEqual([0, 0])
        }, 50000000)


        test('like -> dislike', async () => {
            await db.repoEventsCommon.voteEvent(userId, eventId, 'like')
            const {plusLikes, plusDislikes} = await db.repoEventsCommon.voteEvent(userId, eventId, 'dislike')
            expect({plusLikes, plusDislikes}).toStrictEqual({plusLikes: -1, plusDislikes: 1})
        }, 50000000)

        test('get likes dislikes', async () => {
            const likesDislikes = await db.repoEventsCommon.getLikesDislikes(eventId)
            expect(likesDislikes).toStrictEqual([0, 0])
        }, 50000000)


    })
})