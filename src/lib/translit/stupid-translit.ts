import { TwoWayMap } from './two-way-map'

export class StupidTranslit {
    static dict = new TwoWayMap([
        ['а', 'a'],
        ['б', 'b'],
        ['в', 'v'],
        ['г', 'g'],
        ['д', 'd'],
        ['е', 'e'],
        ['ё', '1'],
        ['ж', 'j'],
        ['з', 'z'],
        ['и', 'i'],
        ['й', '2'],
        ['к', 'k'],
        ['л', 'l'],
        ['м', 'm'],
        ['н', 'n'],
        ['о', 'o'],
        ['п', 'p'],
        ['р', 'r'],
        ['с', 's'],
        ['т', 't'],
        ['у', 'u'],
        ['ф', 'f'],
        ['х', 'h'],
        ['ц', '3'],
        ['ч', 'c'],
        ['ш', '4'],
        ['щ', '5'],
        ['ъ', '6'],
        ['ы', 'y'],
        ['ь', '7'],
        ['э', '8'],
        ['ю', '0'],
        ['я', '9'],
        [' ', '_'],
    ]);

    static translit(str: string) {
        return Array.from(str.toLowerCase())
            .reduce((s, l) =>
                s + (
                    StupidTranslit.dict.get(l)
                    || StupidTranslit.dict.get(l) === undefined && l
                ), '');
    }

    static reverse(str: string) {
        return Array.from(str.toLowerCase())
            .reduce((s, l) =>
                s + (
                    StupidTranslit.dict.revGet(l)
                    || StupidTranslit.dict.revGet(l) === undefined && l
                ), '');
    }
}