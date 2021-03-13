import { cardFormat } from '../../../src/scenes/shared/card-format'
import { Event } from '../../../src/interfaces/app-interfaces'
import path from 'path'
import { formatPrice, parsePrice } from '../../../src/lib/price-parser'
import fs from 'fs'
import util from 'util'

const readFile = util.promisify(fs.readFile)

async function readCard(card: string) {
    return await readFile(path.resolve(__dirname, `cards/${card}`), 'utf8')
}

const defaultEvent: Event = {
    extId: '',
    title: 'A',
    category: 'theaters',
    description: 'описание',
    timetable: `17 октября: 11:30 - 23:45`,
    notes: 'notes',
    price: '100 руб',
    duration: '2 часа',
    address: '',
    tag_level_1: ['#level1'],
    tag_level_2: ['#level2', '#_служебный_тег'],
    tag_level_3: ['#level3'],
    rating: 15,
    geotag: '',
    publish: '',
    place: '',
    url: '',
    reviewer: '',
    likes: 0,
    dislikes: 0
}

const prepare = (str: string) => {
    return str.split(/[\n\r]+/).map(l => l.trim()).join('\n')
}

describe('test card format', () => {

    test('Show base card', async () => {
        const event: Event = {
            ...defaultEvent,
        }
        const card = cardFormat(event, { showTags: true })
        const expected = (await readCard('show-base.html')).toString()
        expect(prepare(card)).toEqual(prepare(expected))
    })

    test('Show nice icon if two line timetable', async () => {
        const event: Event = {
            ...defaultEvent,
            category: 'movies',
            timetable: `
                17 октября: 11:30 - 23:45 (https://afisha.yandex.ru/saint-petersburg/cinema/dovod?source=search-page&schedule-preset=tomorrow)
                18 октября: 11:30 - 23:45 (https://afisha.yandex.ru/saint-petersburg/cinema/dovod?source=search-page&schedule-date=2020-10-18)
            `,
        }
        const card = cardFormat(event, { showTags: true })
        const expected = (await readCard('show-timetable-prefix-cinema.html')).toString()
        expect(prepare(card)).toStrictEqual(prepare(expected))
    })

    test('Cut first half of timetable', async () => {
        const event: Event = {
            ...defaultEvent,
            category: 'movies',
            timetable: `12 ноября 2020 - 29 ноября 2020: сб-вс: 10:00 - 18:00`,
        }
        const card = cardFormat(event, { showTags: true })
        const expected = (await readCard('show-timetable-cut-year.html')).toString()
        expect(prepare(card)).toEqual(prepare(expected))
    })

    test('Show date icon when complex timetable in events', async () => {
        const event: Event = {
            ...defaultEvent,
            category: 'events',
            timetable: `пн: 12:00\nвт: 12:00`,
        }
        const card = cardFormat(event, { showTags: true })
        const expected = (await readCard('show-timetable-prefix-event.html')).toString()
        expect(prepare(card)).toEqual(prepare(expected))
    })

    test('Human formatting timetable should not change', async () => {
        const event: Event = {
            ...defaultEvent,
            category: 'events',
            timetable: '{bot: пн: 12:00\nвт: 12:00} Лиса',
        }
        const card = cardFormat(event, { showTags: true })
        expect(card).toContain('Лиса')
        expect(card).not.toContain('вт: 12:00')
    })

    test('Show where icon', async () => {
        const event: Event = {
            ...defaultEvent,
            category: 'theaters',
            place: 'Театр кота'
        }
        const card = cardFormat(event, { showTags: true })
        const expected = (await readCard('show-icon-theatre.html')).toString()
        expect(prepare(card)).toEqual(prepare(expected))
    })

    test('Test minutes helper (no minutes)', async () => {
        expect(cardFormat({
            ...defaultEvent,
            duration: '60 минут'
        })).toContain('1 ч')
    })

    test('Test minutes helper (with minutes)', async () => {
        expect(cardFormat({
            ...defaultEvent,
            duration: '90 минут'
        })).toContain('1 ч 30 мин')
    })

})

describe('rouble formatting', () => {
    test.each([
        ['350 руб, билет на два дня 500 руб', '350 ₽, билет на два дня 500 ₽'],
        ['350 руб', '350 ₽'],
    ])('%s', (old: string, expected: string) => {
        expect(formatPrice(parsePrice(old))).toEqual(expected)
    })
})
