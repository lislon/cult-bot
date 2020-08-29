import { db } from '../../db';
import { EventCategory } from '../../interfaces/app-interfaces'

export async function loadTop5Events(cat: EventCategory): Promise<Event[]> {
    const data = await db.any<Event>('' +
        'select * ' +
        'from cb_events ce ' +
        'where category = $1 ' +
        'order by rating  desc ' +
        'limit 5 ', [cat.toString()]);

    console.log('DATA:', data); // print data;
    return data;
}
//
// export async function loadAllTheatres(): Promise<any> {
//     try {
//         console.log('1')
//         const res = await db.many('' +
//             'select * ' +
//             'from cb_events ce ' +
//             'where category = $1 ' +
//             'order by rating  desc ' +
//             'limit 5 ', ['Theatre'])
//         return res.values();
//     } catch (e) {
//         console.log(e)
//     }
//     return undefined;
// }
//
