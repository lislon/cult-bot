import { chidrensTags, Event, TagLevel2 } from '../interfaces/app-interfaces'
import { db } from '../db'
import { Moment } from 'moment'
import { mapToPgInterval } from './db-utils'

export interface CustomFilter {
    weekendRange: Moment[]
    oblasti?: string[]
    cennosti?: TagLevel2[]
    offset?: number
    limit?: number
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

function doQueryCore(customFilter: CustomFilter) {
    const queryBody = `        FROM cb_events cb
        WHERE
            EXISTS(
                SELECT *
                FROM cb_events_entrance_times cbet
                where cbet.event_id = cb.id AND $(interval) && cbet.entrance)
            AND cb.tag_level_1 @> $(oblasti)
            AND cb.tag_level_2 @> $(cennosti)
            AND (cb.tag_level_2 && $(childTagsAlternatives) OR $(childTagsAlternatives) = '{}')`

    const cennosti = customFilter.cennosti || [];
    const cennostiFilteredFromHardTags = cennosti.filter(c => !chidrensTags.includes(c))

    const queryParams = {
        oblasti: customFilter.oblasti || [],
        cennosti: cennostiFilteredFromHardTags || [],
        childTagsAlternatives: childAlternativesLogic(cennosti),
        interval: `[${mapToPgInterval(customFilter.weekendRange)}]`,
    }
    return {queryBody, queryParams}
}

export async function findEventsCustomFilter(customFilter: CustomFilter): Promise<Event[]> {
    const {queryBody, queryParams} = doQueryCore(customFilter)

    const sql = `
        SELECT cb.*
            ${queryBody}
        order by
            cb.is_anytime ASC,
            cb.rating DESC,
            cb.title ASC
        limit $(limit)
        offset $(offset)
    `
    return await db.any(sql,
        {
            ...queryParams,
            limit: customFilter.limit || 3,
            offset: customFilter.offset || 0
        }
    ) as Event[];
}


export async function countEventsCustomFilter(customFilter: CustomFilter): Promise<number> {
    const {queryBody, queryParams} = doQueryCore(customFilter)

    const sql = `SELECT COUNT(*) AS count ${queryBody}`
    const numberPromise = await db.one(sql, queryParams)
    return +(numberPromise['count'])
}
