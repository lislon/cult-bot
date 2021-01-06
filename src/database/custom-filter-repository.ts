import { chidrensTags, Event, EventFormat, moneyTags, MyInterval, TagLevel2 } from '../interfaces/app-interfaces'
import { mapToPgInterval, rangeHalfOpenIntersect } from './db-utils'
import { IDatabase, IMain } from 'pg-promise'
import { mapEvent, SELECT_ALL_EVENTS_FIELDS } from './db-events-common'


export interface CustomFilter {
    weekendRange: MyInterval
    timeIntervals?: MyInterval[]
    format?: EventFormat
    oblasti?: string[]
    cennosti?: TagLevel2[]
    offset?: number
    limit?: number
}
export class CustomFilterRepository {
    constructor(private db: IDatabase<any>, private pgp: IMain) {
    }

    public async findEventsCustomFilter(customFilter: CustomFilter): Promise<Event[]> {
        const {queryBody, queryParams} = doQueryCore(customFilter)

        const sql = `
        SELECT ${SELECT_ALL_EVENTS_FIELDS} ${queryBody}
        order by
            cb.is_anytime ASC,
            cb.rating DESC,
            cb.title ASC
        limit $(limit)
        offset $(offset)
    `
        return await this.db.map(sql,
            {
                ...queryParams,
                limit: customFilter.limit || 3,
                offset: customFilter.offset || 0
            }, mapEvent);
    }


    public async countEventsCustomFilter(customFilter: CustomFilter): Promise<number> {
        const {queryBody, queryParams} = doQueryCore(customFilter)

        const sql = `SELECT COUNT(cb.id) AS count ${queryBody}`
        const numberPromise = await this.db.one(sql, queryParams)
        return +(numberPromise['count'])
    }

}

function childAlternativesLogic(cennosti: TagLevel2[]): TagLevel2[] {
    const childTag = cennosti.find(c => chidrensTags.includes(c))

    switch (childTag) {
        case '#сдетьми0+':
            return ['#сдетьми0+']
        case '#сдетьми6+':
            return ['#сдетьми0+', '#сдетьми6+']
        case '#сдетьми12+':
            return ['#сдетьми6+', '#сдетьми12+']
        case '#сдетьми16+':
            return ['#сдетьми12+', '#сдетьми16+']
        default:
            return []
    }
}
function priceTagsAlternativesLogic(cennosti: TagLevel2[]): TagLevel2[] {
    return cennosti.filter(c => moneyTags.includes(c))
}



function doQueryCore(customFilter: CustomFilter) {
    const queryBody = `
        FROM cb_events cb
        WHERE cb.deleted_at IS NULL AND EXISTS
            (
                SELECT *
                FROM cb_events_entrance_times cbet
                where cbet.event_id = cb.id
                    AND ${rangeHalfOpenIntersect('$(weekendRange)::tstzrange', 'cbet.entrance')}
                    AND
                    (
                        $(timeIntervals)::tstzrange[] = '{}'
                        OR EXISTS
                        (
                               select *
                               from unnest($(timeIntervals)::tstzrange[]) range
                               where ${rangeHalfOpenIntersect('range', 'cbet.entrance')}
                        )
                    )
            )
            AND (cb.tag_level_1 && $(oblasti) OR $(oblasti) = '{}')
            AND (cb.tag_level_2 @> $(cennosti) OR $(cennosti) = '{}')
            AND (cb.tag_level_2 && $(childTagsAlternatives) OR $(childTagsAlternatives) = '{}')
            AND (cb.tag_level_2 && $(priceTagsAlternatives) OR $(priceTagsAlternatives) = '{}')
            AND (
                   ((CASE WHEN cb.address = 'онлайн' THEN 'online' ELSE 'outdoor' END) = $(format))
                   OR
                   $(format) IS NULL
                )
            `

    const cennosti = customFilter.cennosti || []
    const cennostiFilteredFromHardTags = cennosti
        .filter(t => !t.startsWith('#_'))
        .filter(c => !chidrensTags.includes(c))
        .filter(c => !moneyTags.includes(c))

    const queryParams = {
        oblasti: customFilter.oblasti || [],
        cennosti: cennostiFilteredFromHardTags || [],
        childTagsAlternatives: childAlternativesLogic(cennosti),
        priceTagsAlternatives: priceTagsAlternativesLogic(cennosti),
        weekendRange: mapToPgInterval(customFilter.weekendRange),
        format: customFilter.format,
        timeIntervals: (customFilter.timeIntervals || []).map(i => mapToPgInterval(i)),
    }
    return {queryBody, queryParams}
}

