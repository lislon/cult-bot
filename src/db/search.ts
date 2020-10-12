import { IDatabase, IMain } from 'pg-promise'
import { Event, EventCategory } from '../interfaces/app-interfaces'
import { Moment } from 'moment'
import { mapToPgInterval } from './db-utils'
import { limitEventsToPage } from '../scenes/shared/shared-logic'

export interface PagingRequest {
    limit?: number
    offset?: number
}

export interface SearchRequest extends PagingRequest {
    query: string
    interval: Moment[]
}

export class SearchRepository {
    constructor(private db: IDatabase<any>, private pgp: IMain) {
    }

    public async search(request: SearchRequest): Promise<Event[]> {

        const fts = `(
                    setweight(to_tsvector('russian', coalesce(title,'')), 'A') ||
                    setweight(to_tsvector('russian', coalesce(description,'')), 'D') ||
                    setweight(to_tsvector('russian', coalesce(place,'')), 'D') ||
                    setweight(to_tsvector('russian',
                            REGEXP_REPLACE( REPLACE(cb_join_arr(tag_level_3), '#', ''), '(?<=[а-яa-z])([А-ЯA-Z])', ' \\1', 'g')), 'B')
                )`
        const finalQuery = `
            SELECT cb.*, ts_rank_cd(${fts}, query) AS rank
            FROM cb_events cb,
            plainto_tsquery('russian', $(query)) query
            WHERE ${fts} @@ query
            AND EXISTS
            (
                select id
                FROM cb_events_entrance_times cbet
                where $(interval) && cbet.entrance AND cbet.event_id = cb.id
            )
            ORDER BY rank DESC, cb.rating DESC, cb.order_rnd
            limit $(limit) offset $(offset)
        `
        return await this.db.any(finalQuery,
            {
                interval: mapToPgInterval(request.interval),
                query: request.query,
                limit: request.limit || limitEventsToPage,
                offset: request.offset || 0
            }) as Event[];
    }
}