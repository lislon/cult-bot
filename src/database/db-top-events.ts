import { Event, EventCategory, MyInterval } from '../interfaces/app-interfaces'
import { TagCategory } from '../interfaces/db-interfaces'
import { mapToPgInterval, rangeHalfOpenIntersect } from './db-utils'
import { IDatabase, IMain } from 'pg-promise'
import { addMinutes } from 'date-fns'

export interface TopEventsQuery {
    category: EventCategory
    interval: MyInterval
    oblasti?: string[]
    limit?: number
    offset?: number
}

export class TopEventsRepository {
    constructor(private db: IDatabase<any>, private pgp: IMain) {
    }

    public async getTop(query: TopEventsQuery): Promise<Event[]> {
        let adjustedIntervals = Object.create(query.interval)
        if (query.category === 'exhibitions') {
            adjustedIntervals = {
                start: addMinutes(query.interval.start, 60),
                end: query.interval.end
            }
        }

        const primaryEvents = `
            SELECT cb.*
            FROM cb_events cb
            WHERE
                EXISTS
                (
                    select id
                    FROM cb_events_entrance_times cbet
                    where ${rangeHalfOpenIntersect('$(interval)::tstzrange', 'cbet.entrance')} AND cbet.event_id = cb.id
                )
                AND cb.category = $(category)
                AND (cb.tag_level_1 && $(oblasti) OR $(oblasti) = '{}')
                AND cb.is_anytime = false
                AND cb.deleted_at IS NULL
            ORDER BY cb.rating DESC, cb.order_rnd
        `

        const secondaryEvents = `
            select
                top30.*
            from
                (select cb.*
                from cb_events cb
                where
                    EXISTS
                    (
                        select id
                        FROM cb_events_entrance_times cbet
                        where ${rangeHalfOpenIntersect('$(interval)::tstzrange', 'cbet.entrance')} AND cbet.event_id = cb.id
                    )
                    and cb.category =  $(category)
                    AND (cb.tag_level_1 && $(oblasti) OR $(oblasti) = '{}')
                    and cb.is_anytime = true
                    AND cb.deleted_at IS NULL
                order by
                    cb.rating desc
                limit 30 ) as top30
            order by top30.order_rnd
        `

        const finalQuery = `(${primaryEvents}) UNION ALL (${secondaryEvents}) limit $(limit) offset $(offset)`

        return await this.db.any(finalQuery,
            {
                interval: mapToPgInterval(adjustedIntervals),
                category: query.category,
                oblasti: query.oblasti || [],
                limit: query.limit || 3,
                offset: query.offset || 0
            }) as Event[];
    }

    private async loadTags(cat: TagCategory) {
        return await this.db.map('' +
            ' SELECT t.name ' +
            ' FROM cb_tags t' +
            ' WHERE t.category = $1' +
            ' ORDER BY t.name', [cat], (row) => row.name) as string[];
    }
}

