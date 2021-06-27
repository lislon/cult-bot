import { chidrensTags, EventFormat, moneyTags, DateInterval, TagLevel2 } from '../interfaces/app-interfaces'
import { mapToPgInterval, rangeHalfOpenIntersect } from './db-utils'
import { IDatabase, IMain } from 'pg-promise'
import { IExtensions, LimitOffset } from './db'


export interface CustomizeFilter extends Partial<LimitOffset> {
    weekendRange: DateInterval
    timeIntervals?: DateInterval[]
    format?: EventFormat
    rubrics?: string[]
    priorities?: TagLevel2[]
}

export class DbCustomizeRepository {
    constructor(private db: IDatabase<IExtensions>, private pgp: IMain) {
    }

    public async findEventIdsCustomFilter(customFilter: CustomizeFilter): Promise<number[]> {
        const {queryBody, queryParams} = doQueryCore(customFilter)

        const sql = `
        SELECT cb.id ${queryBody}
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
            }, row => +row.id)
    }


    public async countEventsCustomFilter(customFilter: CustomizeFilter): Promise<number> {
        const {queryBody, queryParams} = doQueryCore(customFilter)

        const sql = `SELECT COUNT(cb.id) AS count ${queryBody}`
        const numberPromise = await this.db.one(sql, queryParams)
        return +(numberPromise['count'])
    }

}

function childAlternativesLogic(priorities: TagLevel2[]): TagLevel2[] {
    const childTag = priorities.find(c => chidrensTags.includes(c))

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

function priceTagsAlternativesLogic(priorities: TagLevel2[]): TagLevel2[] {
    return priorities.filter(c => moneyTags.includes(c))
}

function doQueryCore(customFilter: CustomizeFilter) {
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
            AND (cb.tag_level_1 && $(rubrics) OR $(rubrics) = '{}')
            AND (cb.tag_level_2 @> $(priorities) OR $(priorities) = '{}')
            AND (cb.tag_level_2 && $(childTagsAlternatives) OR $(childTagsAlternatives) = '{}')
            AND (cb.tag_level_2 && $(priceTagsAlternatives) OR $(priceTagsAlternatives) = '{}')
            AND (
                   ((CASE WHEN cb.address = 'онлайн' THEN 'online' ELSE 'outdoor' END) = $(format))
                   OR
                   $(format) IS NULL
                )
            `

    const priorities = customFilter.priorities || []
    const prioritiesFilteredFromHardTags = priorities
        .filter(c => !chidrensTags.includes(c))
        .filter(c => !moneyTags.includes(c))

    const queryParams = {
        rubrics: customFilter.rubrics || [],
        priorities: prioritiesFilteredFromHardTags || [],
        childTagsAlternatives: childAlternativesLogic(priorities),
        priceTagsAlternatives: priceTagsAlternativesLogic(priorities),
        weekendRange: mapToPgInterval(customFilter.weekendRange),
        format: customFilter.format,
        timeIntervals: (customFilter.timeIntervals || []).map(i => mapToPgInterval(i)),
    }
    return {queryBody, queryParams}
}

