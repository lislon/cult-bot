import { DbEvent, EventToSave } from '../interfaces/db-interfaces'
import { db, pgp } from '../db'
import { Event } from '../interfaces/app-interfaces'

function mapToDb(event: EventToSave): DbEvent {
    delete event.primaryData.publish

    return {
        ... event.primaryData,
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

export async function syncDatabase(rows: EventToSave[]) {
    const dbRows = rows.map(r => mapToDb(r))

    if (dbRows.length > 0) {

        const dbColEvents = new pgp.helpers.ColumnSet(Object.keys(dbRows[0]), {table: 'cb_events'});
        const dbColIntervals = new pgp.helpers.ColumnSet(['event_id', 'time_from', 'time_to'], {table: 'cb_time_intervals'});

        await db.tx(async dbTx => {
            await dbTx.none('DELETE FROM cb_events')
            const s = pgp.helpers.insert(dbRows, dbColEvents) + ' RETURNING id'
            // console.log(s)
            const ids = await dbTx.map(s, [], r => +r.id)

            const allIntervals = convertToIntervals(rows, ids)
            if (allIntervals.length > 0) {
                await dbTx.none(pgp.helpers.insert(allIntervals, dbColIntervals))
            }
        })
    }
}