import { EventDuration, parseDuration, PartDuration } from '../../src/lib/duration-parser'
import { fail } from 'parsimmon'

function expectDurationParser(text: string, expected: EventDuration): void {
    const actual = parseDuration(text)
    if (actual.status === true) {
        expect(actual.value).toEqual(expected)
    } else if (expected !== 'unknown') {
        fail(actual.expected.join('\n'))
    }
}

function makeDuration(hours: number, minutes: number) {
    return (hours * 60 + minutes) * 60
}

function durationFixed(hours: number, minutes: number = 0, title: string = undefined, comment: string = undefined): PartDuration {
    const duration = makeDuration(hours, minutes)
    return { min: duration, max: duration, title, comment }
}

describe('duration parser', () => {
    test('unknown', () => {
        expectDurationParser('', 'unknown')
    })

    test('hour simple', () => {
        expectDurationParser('10 ч', [ durationFixed(10) ])
    })
    test('hour simple 2', () => {
        expectDurationParser('10 часов', [ durationFixed(10) ])
    })

    test('hour + minutes', () => {
        expectDurationParser('10 ч 30 мин ', [ durationFixed(10, 30) ])
    })

    test('only minutes', () => {
        expectDurationParser('111 мин', [ durationFixed(0, 111) ])
    })

    test('2 parts simple', () => {
        expectDurationParser('раз 1 ч 13 мин\n' +
            'два 39 мин', [ durationFixed(1, 13, 'раз'),
                     durationFixed(0, 39, 'два')])
    })

    test('2 parts complex', () => {
        expectDurationParser('1 часть 1 ч 13 мин\n' +
            '    2 часть 39 мин', [ durationFixed(1, 13, '1 часть'),
            durationFixed(0, 39, '2 часть')])
    })

    test('days single', () => {
        expectDurationParser('2 дня', [ durationFixed(48, 0) ])
    })

    test('with comment', () => {
        expectDurationParser('2 ч (длительность 1 лекции)',
            [ durationFixed(2, 0, undefined, 'длительность 1 лекции') ])
    })

    test('range style 1', () => {
        expectDurationParser('1 ч - 2 ч', [ {
                min: makeDuration(1, 0),
                max: makeDuration(2, 0)
            } ])
    })

    test('range style 2', () => {
        expectDurationParser('1-2 ч', [ {
            min: makeDuration(1, 0),
            max: makeDuration(2, 0)
        } ])
    })

    test('range style 3', () => {
        expectDurationParser('от 30 мин до 1 ч', [ {
            min: makeDuration(0, 30),
            max: makeDuration(1, 0)
        } ])
    })

    test('range style 4', () => {
        expectDurationParser('от 31 мин до 1 ч 15 мин', [ {
            min: makeDuration(0, 31),
            max: makeDuration(1, 15)
        } ])
    })


    test('more then', () => {
        expectDurationParser('более 2 ч', [ {
                min: makeDuration(2, 0),
                max: undefined
            } ])
    })

    test('more then #2', () => {
        expectDurationParser('от 2 ч 5 мин', [ {
            min: makeDuration(2, 5),
            max: undefined
        } ])
    })

    test('range', () => {
        expectDurationParser('от 12 мин до 1 ч', [ {
                min: makeDuration(0, 12),
                max: makeDuration(1, 0)
            } ])
    })

    test('bad', () => {
        expectDurationParser('2 серии длительностью 12 мин и 11 мин', 'unknown')
    })
    test('bad: single part with title', () => {
        expectDurationParser('около 1 ч', 'unknown')
    })
    test('bad: 2 part without title', () => {
        expectDurationParser('1 ч\n2ч', 'unknown')
    })
    test('bad: 3', () => {
        expectDurationParser('пеший маршрут 1.5 км', 'unknown')
    })



})