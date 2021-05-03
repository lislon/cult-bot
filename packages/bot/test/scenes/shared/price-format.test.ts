import { formatPrice, parsePrice } from '../../../src/lib/price-parser'

describe('rouble formatting', () => {
    test.each([
        ['350 руб, билет на два дня 500 руб', '350 ₽, билет на два дня 500 ₽'],
        ['350 руб', '350 ₽'],
    ])('%s', (old: string, expected: string) => {
        expect(formatPrice(parsePrice(old))).toEqual(expected)
    })
})
