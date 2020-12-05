import { chunkString } from '../../src/util/chunk-split'

describe('translit', () => {
    test('short line', () => {
        const actual = chunkString('hello bob this', 6)
        expect(actual).toEqual([
            'hello',
            `bob`,
            'this'
        ])
    })

    test('should not mangle anything below the threshold size', function() {
        expect(chunkString('foo', 4)).toEqual(['foo'])
    })
    test('should split at spaces', function() {
        expect(chunkString('foo bar', 4)).toEqual(['foo', 'bar'])
    })
    test('should split at spaces with different size pieces', function() {
        expect(chunkString('foo a bar', 4)).toEqual(['foo', 'a', 'bar'])
    })
    test('should harshly split items that have no spaces', function() {
        expect(chunkString('foobarbaz', 4)).toEqual(['foob', 'arba', 'z'])
    })
    test('should maintain words under threshold and still split up another piece', function() {
        expect(chunkString('foo barbazqux', 4)).toEqual(['foo ', 'barb', 'azqu', 'x'])
    })
    test('should split up piece first and maintain words in another piece under threshold', function() {
        expect(chunkString('barbazqux foo', 4)).toEqual(['barb', 'azqu', 'x', 'foo'])
    })
    test('should merge some space pieces together that fit', function() {
        expect(chunkString('do foo and bar', 8)).toEqual(['do foo', 'and bar'])
    })

})