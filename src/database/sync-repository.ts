import { DbEvent, EventToSave } from '../interfaces/db-interfaces'
import { encodeTagsLevel1 } from '../util/tag-level1-encoder'
import { ColumnSet, IDatabase, IMain, ITask } from 'pg-promise';

function generateRandomOrder() {
    return Math.ceil(Math.random() * 1000000)
}

export class EventsSyncRepository {
    readonly dbColIntervals: ColumnSet
    readonly dbColEvents: ColumnSet

    constructor(private db: IDatabase<any>, private pgp: IMain) {
        this.dbColIntervals = new pgp.helpers.ColumnSet(['event_id', 'entrance'], {table: 'cb_events_entrance_times'});
        const strings: (keyof DbEvent)[] = [
            'category',
            'subcategory',
            'title',
            'place',
            'address',
            'geotag',
            'timetable',
            'duration',
            'price',
            'notes',
            'description',
            'url',
            'tag_level_1',
            'tag_level_2',
            'tag_level_3',
            'rating',
            'reviewer',
            'is_anytime',
            'order_rnd'
        ]
        this.dbColEvents = new pgp.helpers.ColumnSet(strings
            , {table: 'cb_events'});
    }

    public async syncDatabase(events: EventToSave[]) {
        const dbRows = events.map(r => EventsSyncRepository.mapToDb(r))

        if (dbRows.length > 0) {

            await this.db.tx(async (dbTx: ITask<{}> & {}) => {
                // await dbTx.none('TRUNCATE cb_time_intervals, cb_events_to_tags, cb_tags, cb_events RESTART identity')
                await dbTx.none('DELETE FROM cb_events')

                const s = this.pgp.helpers.insert(dbRows, this.dbColEvents) + ' RETURNING id'
                const eventIds = await dbTx.map(s, [], r => +r.id)

                const allIntervalsData = EventsSyncRepository.convertToIntervals(events, eventIds)
                if (allIntervalsData.length > 0) {
                    await dbTx.none(this.pgp.helpers.insert(allIntervalsData, this.dbColIntervals))
                }
            })
        }
    }


    private static mapToDb(event: EventToSave): DbEvent {
        delete event.primaryData.publish

        event.primaryData.tag_level_1 = encodeTagsLevel1(event.primaryData.category, event.primaryData.tag_level_1);

        return {
            ...event.primaryData,
            is_anytime: event.is_anytime,
            order_rnd: event.order_rnd !== undefined ? event.order_rnd : generateRandomOrder()
        };
    }

    private static convertToIntervals(rows: EventToSave[], ids: number[]) {
        return rows.flatMap((r, index) => {
            const eventId = ids[index]

            const m = r.timeIntervals.map(ti => {
                if (Array.isArray(ti)) {
                    return {
                        event_id: eventId,
                        entrance: `[${ti.map(i => i.toISOString()).join(',')})`
                    }
                } else {
                    return {
                        event_id: eventId,
                        entrance: `[${ti.toISOString()}, ${ti.toISOString()}]`,
                    }
                }
            })
            return m;
        })
    }
}

