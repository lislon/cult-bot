import { DbEvent, EventToSave } from '../interfaces/db-interfaces'
import { db, pgp } from '../db'
import { encodeTagLevel1 } from '../util/tag-level1-encoder'
import { ITask } from 'pg-promise';

function mapToDb(event: EventToSave): DbEvent {
    delete event.primaryData.publish

    event.primaryData.tag_level_1 = encodeTagLevel1(event.primaryData);

    return {
        ...event.primaryData,
        is_anytime: !!event.timetable.anytime
    };
}

function convertToIntervals(rows: EventToSave[], ids: number[]) {
    const allIntervals = rows.flatMap((r, index) => {
        const eventId = ids[index]

        const m = r.timeIntervals.map(ti => {
            if (Array.isArray(ti)) {
                return {
                    event_id: eventId,
                    entrance: `[${ti.map(i => i.toISOString(true)).join(',')})`
                }
            } else {
                return {
                    event_id: eventId,
                    entrance: `[${ti.toISOString(true)}, ${ti.toISOString(true)}]`,
                }
            }
        })
        return m;
    })
    return allIntervals
}

// function convertsToTagsData(allTagsData: Tag[], tagIds: number[], events: EventToSave[], ids: number[]) {
//     const tagToId = new Map(allTagsData.map(({category, name}, index) => [`${category}:${name}`, tagIds[index]]))
//
//     const allEventsToTagsData = events.flatMap((r, index) => {
//         const eventId = ids[index]
//
//         return r.tags
//             .map(t => tagToId.get(`${t.category}:${t.name}`))
//             .map(tagId => {
//                 return {
//                     event_id: eventId,
//                     tag_id: tagId
//                 }
//             })
//     });
//     return allEventsToTagsData
// }
//
// function onlyUnique(value: Tag, index: number, self: Tag[]) {
//     return self.find(s => s.category == value.category && s.name === value.name) === value;
// }

export async function syncDatabase(events: EventToSave[]) {
    const dbRows = events.map(r => mapToDb(r))

    if (dbRows.length > 0) {

        const dbColEvents = new pgp.helpers.ColumnSet(Object.keys(dbRows[0]), {table: 'cb_events'});
        const dbColIntervals = new pgp.helpers.ColumnSet(['event_id', 'entrance'], {table: 'cb_events_entrance_times'});

        await db.tx(async (dbTx: ITask<{}> & {}) => {
            // await dbTx.none('TRUNCATE cb_time_intervals, cb_events_to_tags, cb_tags, cb_events RESTART identity')
            await dbTx.none('DELETE FROM cb_events')

            const s = pgp.helpers.insert(dbRows, dbColEvents) + ' RETURNING id'
            const eventIds = await dbTx.map(s, [], r => +r.id)

            const allIntervalsData = convertToIntervals(events, eventIds)
            if (allIntervalsData.length > 0) {
                await dbTx.none(pgp.helpers.insert(allIntervalsData, dbColIntervals))
            }
        })
    }
}
