import { decodeBillToken, encodeBillToken } from '../../../src/lib/subscription/subscription'

describe('subscription', () => {
    test('encode url', () => {
        const original = {userId: 1, days: 10}
        const encoded = encodeBillToken(original)
        const actual = decodeBillToken(encoded)
        expect(actual).toEqual(original)
    })
})