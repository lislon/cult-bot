import { EventTimetable, MomentOrInterval, rightDate } from '@culthub/timetable'
import { last } from 'lodash'
import { differenceInSeconds } from 'date-fns'
import { TagLevel2 } from '../interfaces/app-interfaces'
import { ALL_CATEGORIES, EventCategory } from '@culthub/interfaces'
import { max } from 'lodash/fp'

export const TAG_LAST_CHANCE: TagLevel2 = '#_последнийшанс'

export const LAST_CHANCE_PREDICT_CONFIG = {
    SCHEDULE_DAYS_AGO: 0,
    SCHEDULE_DAYS_AHEAD: max(ALL_CATEGORIES.map(getThresholdDaysForCategory)) + 1
}

export interface LastChanceEvent {
    parsedTimetable: EventTimetable
    category: EventCategory
    now: Date
    predictedIntervals: MomentOrInterval[]
    tagLevel2: TagLevel2[]
}


export function autoAppendLastChanceTags(params: LastChanceEvent): TagLevel2[] {
    return [...params.tagLevel2.filter(e => e !== TAG_LAST_CHANCE), ...(isLastChance(params) ? [TAG_LAST_CHANCE] : [])]
}


function isLastChance({parsedTimetable, now, predictedIntervals, tagLevel2, category}: LastChanceEvent): boolean {
    if (tagLevel2.includes('#последнийшанс')) {
        return true
    }
    if (parsedTimetable.weekTimes?.length > 0 || parsedTimetable.anytime) {
        return false
    }
    if (parsedTimetable.dateRangesTimetable?.length > 0 && predictedIntervals.length > 0) {
        const lastInterval = last(predictedIntervals)
        const diff = differenceInSeconds(rightDate(lastInterval), now) / 3600.0 / 24.0
        if (diff >= 0 && diff <= getThresholdDaysForCategory(category)) {
            return true
        }
    }
    return false
}

function getThresholdDaysForCategory(category: EventCategory): number {
    switch (category) {
        case 'exhibitions':
            return 14
        default:
            return 7
    }
}