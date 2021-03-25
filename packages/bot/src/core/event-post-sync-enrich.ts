import { EventTimetable, MomentOrInterval } from '@culthub/timetable'
import { Event } from '../interfaces/app-interfaces'
import { autoAppendCostTags } from './cost-tags'
import { autoAppendLastChanceTags } from './last-chance'
import { autoAppendDurationTags } from './duration-tags'
import { EventDuration } from '../lib/duration-parser'

export type ErrorCallback = (errors: string[]) => void

export interface AutoAppendTagsOptions {
    parsedTimetable?: EventTimetable
    predictedIntervals: MomentOrInterval[]
    parsedDuration: EventDuration
    errorCallback?: ErrorCallback
    warningCallback?: ErrorCallback
    now: Date
}

export function enrichEventWithAutotags(event: Event, options: AutoAppendTagsOptions): Event {
    let tagLevel2 = event.tag_level_2
    tagLevel2 = autoAppendCostTags(tagLevel2, event, options.errorCallback, options.warningCallback)
    tagLevel2 = autoAppendDurationTags(tagLevel2, event, options.parsedDuration, options.errorCallback, options.warningCallback)
    if (options.parsedTimetable !== undefined) {
        tagLevel2 = autoAppendLastChanceTags({
            now: options.now,
            tagLevel2,
            category: event.category,
            parsedTimetable: options.parsedTimetable,
            predictedIntervals: options.predictedIntervals
        })
    }
    return {...event, tag_level_2: tagLevel2}
}