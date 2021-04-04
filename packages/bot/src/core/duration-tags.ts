import { EventNoId, TagLevel2 } from '../interfaces/app-interfaces'
import { EventDuration } from '../lib/duration-parser'
import { max } from 'lodash'

export function autoAppendDurationTags(existingTags: TagLevel2[], data: EventNoId, duration: EventDuration, errorCallback?: (errors: string[]) => void, warningCallback?: (errors: string[]) => void): TagLevel2[] {
    if (existingTags.includes('#успетьзачас')) {
        warningCallback?.([`Тег '#успетьзачас' ставится автоматически. Уберите, плиз его из карточки`])
    }

    if (duration !== 'unknown') {
        const hasInfitive = duration.find(d => d.max === undefined)

        if (!hasInfitive) {
            const maxDurations = duration.map(d => d.max)
            const maxMinutes = max(maxDurations) / 60;
            if (maxMinutes <= 60) {
                return [...existingTags.filter(s => s !== '#успетьзачас'), '#успетьзачас']
            }
        }
    }

    return existingTags
}