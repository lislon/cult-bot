import { Event, EventCategory, MyInterval } from '../interfaces/app-interfaces'
import { TagCategory } from '../interfaces/db-interfaces'
import { mapToPgInterval } from './db-utils'
import { IDatabase, IMain } from 'pg-promise'
import { addMinutes } from 'date-fns'

export class TopEventsRepository {
    constructor(private db: IDatabase<any>, private pgp: IMain) {
    }

    public async getTop(category: EventCategory, interval: MyInterval, limit: number = 3, offset: number = 0): Promise<Event[]> {
        let adjustedIntervals = Object.create(interval)
        if (category === 'exhibitions') {
            adjustedIntervals = {
                start: addMinutes(interval.start, 60),
                end: interval.end
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
                where $(interval) && cbet.entrance AND cbet.event_id = cb.id
            )
            AND cb.category = $(category)
            AND cb.is_anytime = false
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
                    where $(interval) && cbet.entrance AND cbet.event_id = cb.id
                )
                and cb.category =  $(category)
                and cb.is_anytime = true
            order by
                cb.rating desc
            limit 30 ) as top30
        order by top30.order_rnd
    `

        const finalQuery = `(${primaryEvents}) UNION ALL (${secondaryEvents}) limit $(limit) offset $(offset)`

        return await this.db.any(finalQuery,
            {
                interval: mapToPgInterval(adjustedIntervals),
                category,
                limit,
                offset
            }) as Event[];
    }

    private async loadTags(cat: TagCategory) {
        return await this.db.map('' +
            ' SELECT t.name ' +
            ' FROM cb_tags t' +
            ' WHERE t.category = $1' +
            ' ORDER BY t.name', [cat], (row) => row.name) as string[];
    }

    public async loadAllPriorities(): Promise<string[]> {
        return await this.loadTags('tag_level_2')
    }

    public async loadAllOblasti(): Promise<string[]> {
        return await this.loadTags('tag_level_1')
    }
}

