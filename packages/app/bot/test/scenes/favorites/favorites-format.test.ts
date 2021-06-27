import { formatListOfFavorites } from '../../../src/scenes/favorites/favorites-format'
import { CtxI18n } from '../../../src/util/scene-helper'
import { i18n } from '../../../src/util/i18n'
import { date } from '../../util/timetable-util'
import { parseAndPredictTimetable } from '../../../src/lib/timetable/timetable-utils'

const ctxI18n: CtxI18n = {
    i18n: {
        t(resourceKey?: string, templateData?: Record<string, unknown>): string {
            return i18n.t(`ru`, resourceKey, templateData)
        }
    }
}

const now = date('2020-01-03 12:00')

async function assertFavoriteTimeFormat(expected: string, timetable: string, tag: 'i' | 's' | '' = 'i') {
    const msg = await formatListOfFavorites(ctxI18n, [
        {
            category: 'exhibitions',
            title: 'title',
            place: 'place',
            address: 'address',
            url: 'https://example.com',
            parsedTimetable: parseAndPredictTimetable(timetable, now, {SCHEDULE_DAYS_AGO: 14, SCHEDULE_DAYS_AHEAD: 14}),
            tag_level_1: []
        }
    ], now)
    expect(msg).toContain(tag ? `<${tag}>${expected}</${tag}>` : expected)
}

describe('format favorites cards', () => {

    test('Empty list', async () => {
        const msg = await formatListOfFavorites(ctxI18n, [], now)
        expect(msg).toStrictEqual('')
    })

    test('In future', async () => {
        await assertFavoriteTimeFormat('до 15 января', '1-15 января: пн-вс: 12:00')
    })
    test('In past', async () => {
        await assertFavoriteTimeFormat('title (прошло 01 января)', '1 января: 12:00', '')
    })

    test('Only weekdays', async () => {
        await assertFavoriteTimeFormat('пн–пт,вс', 'пн–пт,вс: 12:00')
    })

    test('Anytime', async () => {
        await assertFavoriteTimeFormat('в любое время (по записи)', 'в любое время (по записи)')
    })

    describe('exhibitions', () => {

        test('In past', async () => {
            await assertFavoriteTimeFormat('до 15 января', '1-15 января: 12:00')
        })

    })
})