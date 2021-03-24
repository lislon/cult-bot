import { EventDuration, parseDuration, PartDuration } from '../../src/lib/duration-parser'

function expectDurationParser(text: string, expected: EventDuration): void {
    const actual = parseDuration(text)
    expect(actual).toEqual(expected)
}

function makeDuration(hours: number, minutes: number) {
    return (hours * 3600 + minutes) * 60
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
        expectDurationParser('10 ч', {
            parts: [ durationFixed(10) ]
        })
    })

    test('hour + minutes', () => {
        expectDurationParser('10 Ч 30 мин', {
            parts: [ durationFixed(10, 30) ]
        })
    })

    test('only minutes', () => {
        expectDurationParser('111 мин', {
            parts: [ durationFixed(0, 111) ]
        })
    })

    test('2 parts simple', () => {
        expectDurationParser('1 часть 1 ч 13 мин\n' +
            '    2 часть 39 мин', {
            parts: [ durationFixed(1, 13, '1 часть'),
                     durationFixed(0, 39, '2 часть')]
        })
    })

    test('days ', () => {
        expectDurationParser('2 дня', {
            parts: [ durationFixed(48, 0) ]
        })
    })

    test('with comment', () => {
        expectDurationParser('2 ч (длительность 1 лекции)', {
            parts: [ durationFixed(2, 0, undefined, 'длительность 1 лекции') ]
        })
    })

    test('more then', () => {
        expectDurationParser('более 2 ч', {
            parts: [ {
                min: makeDuration(2, 0),
                max: undefined
            } ]
        })
    })

    test('range', () => {
        expectDurationParser('от 12 мин до 1 ч', {
            parts: [ {
                min: makeDuration(0, 12),
                max: makeDuration(1, 0)
            } ]
        })
    })



    test('bad', () => {
        expectDurationParser('2 серии длительностью 12 мин и 11 мин', undefined)
    })
    test('bad2', () => {
        expectDurationParser('около 1 ч', undefined)
    })


})