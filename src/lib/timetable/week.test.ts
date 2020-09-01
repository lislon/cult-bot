// any -> 12:00-13:00
const parseWeek = (str: string): string | undefined => {
    const digit = '(\\d{1,2}(?:[:][0-9]{2})?)'
    const timeDash = new RegExp(digit + '\\s*-\\s*' + digit)
    const timeRus = new RegExp('[cс]\\s+' + digit + '\\s+до\\s+' + digit)
    const m = timeDash.exec(str) || timeRus.exec(str)
    if (!m) return undefined

    const norm = (s: string) => (s == undefined ? '24' : s.padStart(2, '0')).padEnd(5, ':00')
    return `${norm(m[1])}-${norm(m[2])}`
}

const parseTimeText = (str: string): string | undefined => {
    if (str.match(/круглосуточно/)) return '00:00-24:00'
    return undefined
}

describe('parseTime', () => {


    test('comma', () => {
        expect(parseTimeClock('Пн, Ср, Сб, Вс')).toBe('11:00-12:00')
    })

    test('с 11:00 до 12:00', () => {
        expect(parseTimeClock('с 11:00 до 12:00')).toBe('11:00-12:00')
    })

    test('с 11 до 12', () => {
        expect(parseTimeClock('с 11 до 12')).toBe('11:00-12:00')
    })

    test('с 11', () => {
        expect(parseTimeClock('с 11')).toBe(undefined)
    })

    test('11', () => {
        expect(parseTimeClock('11')).toBe(undefined)
    })

})