import { CtxI18n } from '../../../src/util/scene-helper'
import { formatListOfFavorites } from '../../../src/scenes/favorites/favorites-format'
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

async function formatMsg(timetable: string): Promise<string> {
    return await formatListOfFavorites(ctxI18n, [
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
}

describe('format favorites cards', () => {

    test('Empty list', async () => {
        expect(await formatListOfFavorites(ctxI18n, [], now)).toStrictEqual('')
    })

    test('In future', async () => {
        await expect(await formatMsg('1-15 января: пн-вс: 12:00')).toContain(`<i>до 15 января</i>`)
    })
    test('In past', async () => {
        await expect(await formatMsg('1 января: 12:00')).toContain('title')
        await expect(await formatMsg('1 января: 12:00')).toContain(`<i>прошло 01 января</${'i'}>`)
    })

    test('Only weekdays', async () => {
        await expect(await formatMsg('пн–пт,вс: 12:00')).toContain(`<i>пн–пт,вс</i>`)
    })

    test('Anytime', async () => {
        await expect(await formatMsg('в любое время (по записи)')).toContain(`<i>в любое время (по записи)</i>`)
    })

    describe('exhibitions', () => {

        test('In past', async () => {
            await expect(await formatMsg('1-15 января: 12:00')).toContain(`<i>до 15 января</i>`)
        })
    })
})