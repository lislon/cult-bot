import { EventPrice, parsePrice } from '../../src/lib/price-parser'

function expectPriceParser(text: string, expected: EventPrice) {
    const actual = parsePrice(text)
    expect(actual).toEqual(expected)
}

describe('price parser', () => {
    test('empty', () => {
        expectPriceParser('', {
            type: 'unknown'
        })
    })

    test('Бесплатно', () => {
        expectPriceParser('Бесплатно', {
            type: 'free'
        })
    })

    test('simple', () => {
        expectPriceParser('1 500 руб', {
            type: 'paid',
            min: 1500,
            max: 1500
        })
    })

    test('from X', () => {
        expectPriceParser('от 300 руб', {
            type: 'paid',
            min: 300,
            max: undefined
        })
    })

    test('range ', () => {
        expectPriceParser('от 300 руб до 800 р', {
            type: 'paid',
            min: 300,
            max: 800
        })
    })

    test('donation', () => {
        expectPriceParser('донейшен', {
            type: 'donation'
        })
    })

    test('with comment', () => {
        expectPriceParser('от 300 руб до 800 р, билеты у кассы', {
            type: 'paid',
            min: 300,
            max: 800,
            comment: 'билеты у кассы'
        })
    })

    test('special', () => {
        expectPriceParser('за заказ в баре', {
            type: 'other',
            comment: 'за заказ в баре'
        })
    })
})