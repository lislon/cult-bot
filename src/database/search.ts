import { IDatabase, IMain } from 'pg-promise'
import { Event, MyInterval } from '../interfaces/app-interfaces'
import { mapToPgInterval } from './db-utils'
import { limitEventsToPage } from '../scenes/shared/shared-logic'
import { mapEvent, SELECT_ALL_EVENTS_FIELDS } from './db-events-common'

export interface PagingRequest {
    limit?: number
    offset?: number
}

export interface SearchRequest extends PagingRequest {
    query: string
    interval: MyInterval
    allowSearchById?: boolean
}

export class SearchRepository {
    constructor(private db: IDatabase<any>, private pgp: IMain) {
    }

    public async searchGetTotal(request: SearchRequest): Promise<number> {
        const {queryBody, queryParams} = this.formatQueryParts(request)
        return await this.db.one(`SELECT COUNT(1) AS total FROM ${queryBody}`, queryParams, r => +r.total);
    }

    public async search(request: SearchRequest): Promise<Event[]> {
        const {fts, queryBody, queryParams} = this.formatQueryParts(request)

        return await this.db.map(`
            SELECT ${SELECT_ALL_EVENTS_FIELDS}, ts_rank_cd(${fts}, query) AS rank
            FROM ${queryBody}
            ORDER BY rank DESC, cb.rating DESC, cb.order_rnd
            limit $(limit) offset $(offset)
        `,
            {
                ...queryParams,
                limit: request.limit || limitEventsToPage,
                offset: request.offset || 0
            }, mapEvent);
    }

    private formatQueryParts(request: SearchRequest) {
        const byIdSearch = request.allowSearchById ? ` OR cb.ext_id = $(query)` : ''

        const fts = `(
                    setweight(to_tsvector('russian', coalesce(title,'')), 'A') ||
                    setweight(to_tsvector('russian', coalesce(description,'')), 'D') ||
                    setweight(to_tsvector('russian', coalesce(place,'')), 'D') ||
                    setweight(to_tsvector('russian',
                            REGEXP_REPLACE(REPLACE(cb_join_arr(tag_level_1), '#', ''), '(?<=[а-яa-z])([А-ЯA-Z])', ' \\1', 'g')), 'D') ||
                    setweight(to_tsvector('russian',
                            REGEXP_REPLACE(REPLACE(cb_join_arr(tag_level_2), '#', ''), '(?<=[а-яa-z])([А-ЯA-Z])', ' \\1', 'g')), 'D') ||
                    setweight(to_tsvector('russian',
                            REGEXP_REPLACE(REPLACE(cb_join_arr(tag_level_3), '#', ''), '(?<=[а-яa-z])([А-ЯA-Z])', ' \\1', 'g')), 'B')
                )`
        const queryBody = `cb_events cb,
            plainto_tsquery('russian', $(query)) query
            WHERE (${fts} @@ query ${byIdSearch})
            AND EXISTS
            (
                select id
                FROM cb_events_entrance_times cbet
                where $(interval) && cbet.entrance AND cbet.event_id = cb.id
            )
            AND cb.deleted_at IS NULL`
        const queryParams = {
            interval: mapToPgInterval(request.interval),
            query: request.query
        }
        return {fts, queryBody, queryParams}
    }
}