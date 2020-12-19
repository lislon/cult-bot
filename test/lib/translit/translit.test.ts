import { ReversableTranslit } from '../../../src/lib/translit/reversable-translit'

describe('translit', () => {
    test.each([
        '#лиса',
        'съешь ещё этих мягких французских булок, да выпей чаю',
        '123456789',
        '#ЗОЖ'
    ])('%s', (text: string) => {
        const translit = ReversableTranslit.translit(text)
        const back = ReversableTranslit.reverse(translit)
        expect(back).toEqual(text)
    })
})