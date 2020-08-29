import { EventCategory } from '../interfaces/app-interfaces'

export const categoryToSheetName: { [key in EventCategory]?: string } = {
    'theaters': 'Театр',
    'exhibitions': 'Выставки',
    'concerts': 'Концерты',
    'events': 'Мероприятия',
    'movies': 'Кино',
    'walks': 'Прогулки'
}

export function mapSheetRow(row: string[], category: EventCategory): {} {
    const notNull = (s: string) => s === undefined ? '' : s;
    const forceDigit = (n: string) => n === undefined ? 0 : +n;
    const splitTags = (s: string) => s.replace(/(\w)#/, '$1 #')


    let c = 1;
    const data = {
        'category': category,
        'publish': row[c++],
        'subcategory': row[c++],
        'title': row[c++],
        'place': notNull(row[c++]),
        'address': notNull(row[c++]),
        'timetable': notNull(row[c++]),
        'duration': notNull(row[c++]),
        'price': notNull(row[c++]),
        'notes': notNull(row[c++]),
        'description': row[c++],
        'url': notNull(row[c++]),
        'tag_level_1': splitTags(notNull(row[c++])),
        'tag_level_2': splitTags(notNull(row[c++])),
        'tag_level_3': splitTags(notNull(row[c++])),
        'rating': forceDigit(row[c++]),
        'reviewer': notNull(row[c]),
    }
    if (data.publish && data.publish.toLocaleLowerCase() === 'публиковать') {
        delete data.publish
        return data;
    }
    return undefined;
}