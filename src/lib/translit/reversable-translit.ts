import { TwoWayMap } from './two-way-map'

export class ReversableTranslit {
    static dict = new TwoWayMap([
        ['а', 'a'],
        ['б', 'b'],
        ['в', 'v'],
        ['г', 'g'],
        ['д', 'd'],
        ['е', 'e'],
        ['ё', 'Y'],
        ['ж', 'j'],
        ['з', 'z'],
        ['и', 'i'],
        ['й', 'I'],
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
        ['ц', 'C'],
        ['ч', 'c'],
        ['ш', 'H'],
        ['щ', 'S'],
        ['ъ', 'J'],
        ['ы', 'y'],
        ['ь', 'P'],
        ['э', 'E'],
        ['ю', 'U'],
        ['я', 'A'],
        [' ', '_'],
    ]);

    static translit(str: string) {
        if (str.match(/[А-ЯЁ]/)) {
            return str;
        }
        if (str.toLowerCase() !== str) {
            throw new Error(`Translit only lowercase but '${str}' given`)
        }
        return Array.from(str)
            .reduce((s, l) =>
                s + (
                    ReversableTranslit.dict.get(l)
                    || ReversableTranslit.dict.get(l) === undefined && l
                ), '');
    }

    static reverse(str: string) {
        if (str.match(/А-Я/)) {
            return str;
        }
        return Array.from(str)
            .reduce((s, l) =>
                s + (
                    ReversableTranslit.dict.revGet(l)
                    || ReversableTranslit.dict.revGet(l) === undefined && l
                ), '');
    }
}