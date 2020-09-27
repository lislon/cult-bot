import { StupidTranslit } from '../../../src/lib/translit/stupid-translit'

describe('translit', () => {
    test.each([
        '#лиса',
        'съешь ещё этих мягких французских булок, да выпей чаю',
        '123456789',
        '#ЗОЖ'
    ])('%s', (text: string) => {
        const translit = StupidTranslit.translit(text)
        const back = StupidTranslit.reverse(translit)
        expect(back).toEqual(text)
    })
})