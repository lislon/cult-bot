import { DbEvent, TagCategory, EventToSave, Tag } from '../interfaces/db-interfaces'
import { db, pgp } from '../db'
import retryTimes = jest.retryTimes
import asyncWrapper from '../util/error-handler'

function mapToDb(event: EventToSave): DbEvent {
    delete event.primaryData.publish

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
                    time_from: ti[0],
                    time_to: ti[1],
                }
            } else {
                return {
                    event_id: eventId,
                    time_from: ti,
                    time_to: undefined,
                }
            }
        })
        return m;
    })
    return allIntervals
}

function convertsToTagsData(allTagsData: Tag[], tagIds: number[], events: EventToSave[], ids: number[]) {
    const tagToId = new Map(allTagsData.map(({category, name}, index) => [`${category}:${name}`, tagIds[index]]))

    const allEventsToTagsData = events.flatMap((r, index) => {
        const eventId = ids[index]

        return r.tags
            .map(t => tagToId.get(`${t.category}:${t.name}`))
            .map(tagId => {
                return {
                    event_id: eventId,
                    tag_id: tagId
                }
            })
    });
    return allEventsToTagsData
}

function onlyUnique(value: Tag, index: number, self: Tag[]) {
    return self.find(s => s.category == value.category && s.name === value.name) === value;
}

export async function syncDatabase(events: EventToSave[]) {
    const dbRows = events.map(r => mapToDb(r))

    if (dbRows.length > 0) {

        const dbColEvents = new pgp.helpers.ColumnSet(Object.keys(dbRows[0]), {table: 'cb_events'});
        const dbColIntervals = new pgp.helpers.ColumnSet(['event_id', 'time_from', 'time_to'], {table: 'cb_time_intervals'});
        const dbColTags = new pgp.helpers.ColumnSet(['name', 'category'], {table: 'cb_tags'});
        const dbColEventsToTags = new pgp.helpers.ColumnSet(['event_id', 'tag_id'], {table: 'cb_events_to_tags'});

        const allTagsData: Tag[] = events.flatMap(r => r.tags).filter(onlyUnique)

        await db.tx(async dbTx => {
            // await dbTx.none('TRUNCATE cb_time_intervals, cb_events_to_tags, cb_tags, cb_events RESTART identity')
            await dbTx.none('DELETE FROM cb_events')
            await dbTx.none('DELETE FROM cb_tags')

            const s = pgp.helpers.insert(dbRows, dbColEvents) + ' RETURNING id'
            // console.log(s)
            const eventIds = await dbTx.map(s, [], r => +r.id)

            const allIntervalsData = convertToIntervals(events, eventIds)
            if (allIntervalsData.length > 0) {
                await dbTx.none(pgp.helpers.insert(allIntervalsData, dbColIntervals))
            }

            let tagIds: number[] = []
            if (allTagsData.length > 0) {
                const tagsQuery = pgp.helpers.insert(allTagsData, dbColTags) + ' RETURNING id'
                tagIds = await dbTx.map(tagsQuery, [], r => +r.id)
            }


            const allEventsToTagsData = convertsToTagsData(allTagsData, tagIds, events, eventIds)

            if (allEventsToTagsData.length > 0) {
                await dbTx.none(pgp.helpers.insert(allEventsToTagsData, dbColEventsToTags))
            }


        })
    }
}