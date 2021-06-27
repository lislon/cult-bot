import { parseDuration } from '../../src/lib/duration-parser'
import { fail } from 'parsimmon'
import { formatDuration } from '../../src/lib/duration-formatter'

function expectDurationFormatter(text: string, expected = text): void {
    const actual = parseDuration(text)
    if (actual.status === true) {
        expect(formatDuration(actual.value)).toEqual(expected)
    } else if (expected !== 'unknown') {
        fail('bad')
    }
}

describe('duration formatter', () => {
    test('unknown', () => {
        expectDurationFormatter('')
    })

    test('hour simple', () => {
        expectDurationFormatter('10 ч')
    })

    test('hour + minutes', () => {
        expectDurationFormatter('10 ч 30 мин')
    })
    test('day + hour + minutes', () => {
        expectDurationFormatter('1 д 20 ч 35 мин')
    })

    test('only minutes', () => {
        expectDurationFormatter('111 мин', '1 ч 51 мин')
    })

    test('2 parts oneline', () => {
        expectDurationFormatter('x:1 ч;x:2 ч', 'x: 1 ч, x: 2 ч')
    })

    test('3 parts complex', () => {
        expectDurationFormatter(`
        перформанс: 30 мин
        экскурсия: 1 ч
        афтерпати: 2 ч (только для своих)
        `.trim(), `перформанс: 30 мин, экскурсия: 1 ч, афтерпати: 2 ч (только для своих)`)
    })

    test('days single', () => {
        expectDurationFormatter('2 дня', '2 д')
    })

    test('with comment', () => {
        expectDurationFormatter('2 ч (длительность 1 лекции)')
    })

    test('range style 1', () => {
        expectDurationFormatter('1–2 ч')
    })

    test('range style 3', () => {
        expectDurationFormatter('от 31 мин до 1 ч 15 мин')
    })

    test('more then', () => {
        expectDurationFormatter('более 2 ч')
    })
})