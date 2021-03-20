import { DateInterval } from '../interfaces/app-interfaces'
import { EventCategory } from '@culthub/interfaces'
import { TagCategory } from '../interfaces/db-interfaces'
import { mapToPgInterval, rangeHalfOpenIntersect } from './db-utils'
import { IDatabase, IMain } from 'pg-promise'
import { addMinutes } from 'date-fns'
import { SELECT_ALL_EVENTS_FIELDS } from './db-events-common'
import { LimitOffset } from './db'

export interface TopEventsDbQuery extends Partial<LimitOffset> {
    category: EventCategory
    interval: DateInterval
    rubrics?: string[]
}

export class TopEventsRepository {
    constructor(private db: IDatabase<any>, private pgp: IMain) {
    }

    public async getTopIds(query: TopEventsDbQuery): Promise<number[]> {
        const {fixedTimeQuery, anyTimeQuery, queryCommonParams} = this.getQueryParts(query)

        const finalQuery = `
            (
                SELECT cb.id
                FROM ${fixedTimeQuery}
                ORDER BY cb.rating DESC, cb.order_rnd
            )
            UNION ALL
            (
                select top30.id
                from ${anyTimeQuery}
                order by top30.order_rnd
            ) limit $(limit) offset $(offset)
        `

        return await this.db.map(finalQuery,
            {
                ...queryCommonParams,
                limit: query.limit || 3,
                offset: query.offset || 0
            }, row => +row.id)
    }

    public async getTopIdsCount(query: TopEventsDbQuery): Promise<number> {
        const {fixedTimeQuery, anyTimeQuery, queryCommonParams} = this.getQueryParts(query)

        const finalQuery = `
        select
            (SELECT COUNT(cb.id) FROM ${fixedTimeQuery}) +
            (select COUNT(top30.id) from ${anyTimeQuery}) AS count
        `

        return await this.db.one(finalQuery, queryCommonParams, row => +row.count)
    }

    private getQueryParts(query: TopEventsDbQuery) {
        let adjustedIntervals = Object.create(query.interval)
        if (query.category === 'exhibitions') {
            adjustedIntervals = {
                start: addMinutes(query.interval.start, 60),
                end: query.interval.end
            }
        }

        const fixedTimeQuery = `cb_events cb
            WHERE
                EXISTS
                (
                    select id
                    FROM cb_events_entrance_times cbet
                    where ${rangeHalfOpenIntersect('$(interval)::tstzrange', 'cbet.entrance')} AND cbet.event_id = cb.id
                )
                AND cb.category = $(category)
                AND (cb.tag_level_1 && $(rubrics) OR $(rubrics) = '{}')
                AND cb.is_anytime = false
                AND cb.deleted_at IS NULL`

        const anyTimeQuery = `(select ${SELECT_ALL_EVENTS_FIELDS}
                from cb_events cb
                where
                    EXISTS
                    (
                        select id
                        FROM cb_events_entrance_times cbet
                        where ${rangeHalfOpenIntersect('$(interval)::tstzrange', 'cbet.entrance')} AND cbet.event_id = cb.id
                    )
                    and cb.category =  $(category)
                    AND (cb.tag_level_1 && $(rubrics) OR $(rubrics) = '{}')
                    and cb.is_anytime = true
                    AND cb.deleted_at IS NULL
                order by
                    cb.rating desc
                limit 30 ) as top30`

        const queryCommonParams = {
            interval: mapToPgInterval(adjustedIntervals),
            category: query.category,
            rubrics: query.rubrics || []
        }
        return {fixedTimeQuery, anyTimeQuery, queryCommonParams}
    }
}

