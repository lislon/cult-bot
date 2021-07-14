import { chunkString } from '../../src/util/chunk-split'

describe('translit', () => {
    test('short line', () => {
        const actual = chunkString('hello\nbob\nthis', 6)
        expect(actual).toEqual([
            'hello',
            `bob`,
            'this'
        ])
    })

    test('tags short', () => {
        const actual = chunkString('<b>hello\nbob\nthis</b>', 14)
        expect(actual).toEqual([
            '<b>hello</b>',
            `<b>bob</b>`,
            '<b>this</b>'
        ])
    })


    test('should not mangle anything below the threshold size', function () {
        expect(chunkString('foo', 4)).toEqual(['foo'])
    })
    test('should split at newline', function () {
        expect(chunkString('foo\nbar', 4)).toEqual(['foo', 'bar'])
    })
    test('should split at newlines with different size pieces', function () {
        expect(chunkString('foo\na\nbar', 4)).toEqual(['foo', 'a', 'bar'])
    })
    test('should harshly split items that have no newlines', function () {
        expect(chunkString('foobarbaz', 4)).toEqual(['foob', 'arba', 'z'])
    })
    test('should maintain words under threshold and still split up another piece', function () {
        expect(chunkString('foo\nbarbazqux', 4)).toEqual(['foo\n', 'barb', 'azqu', 'x'])
    })
    test('should split up piece first and maintain words in another piece under threshold', function () {
        expect(chunkString('barbazqux\nfoo', 4)).toEqual(['barb', 'azqu', 'x', 'foo'])
    })
    test('should merge some space pieces together that fit', function () {
        expect(chunkString('do\nfoo\nand\nbar', 8)).toEqual(['do\nfoo', 'and\nbar'])
    })

})