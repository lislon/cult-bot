import { IDatabase, IMain } from 'pg-promise'
import { FindMatchingEventRequest, MatchingFoundEvent, MatchingSearchEvent } from '@culthub/interfaces'
import { IExtensions } from './db'

export class EventsMatchingRepository {
    constructor(private db: IDatabase<IExtensions>, private pgp: IMain) {
    }

    public async findMatchingEvents(request: FindMatchingEventRequest): Promise<MatchingFoundEvent[]> {
        const regex = (col: string) => `regexp_replace(lower(${col}), '"', '', 'g')`
        const finalQuery = `
          select r.id, string_agg(cb.ext_id, ',') AS ext_ids
          from (VALUES $1) AS r(id, category, title)
          LEFT JOIN cb_events cb ON cb.category = r.category AND ${regex('cb.title')} = ${regex('r.title')}
          group by r.id          
        `
        return await this.db.map(finalQuery, this.wrap(request.events), (r) => ({
            id: r.id,
            extIds: r.ext_ids?.split(/,/) || []
        }))
    }

    private wrap(arr: MatchingSearchEvent[]) {
        return {
            rawType: true,
            toPostgres: () => arr.map(se => this.pgp.as.format('($1, $2, $3)', [se.id, se.category, se.title])).join()
        }
    }
}

