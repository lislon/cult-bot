import { EventDuration } from './duration-parser'
import { isEqual, zip } from 'lodash'

function formatSingleDuration(seconds?: number): [string[], string[]] {
    const numbers = []
    const units = []
    if (seconds === undefined) {
        return [[], []]
    }
    if (seconds >= 60 * 60 * 24) {
        numbers.push(`${Math.floor(seconds / (60 * 60 * 24))}`)
        units.push('д')
        seconds = seconds % (60 * 60 * 24)
    }
    if (seconds >= 60 * 60) {
        numbers.push(`${Math.floor(seconds / (60 * 60))}`)
        units.push('ч')
        seconds = seconds % (60 * 60)
    }
    if (seconds >= 60) {
        numbers.push(`${Math.floor(seconds / 60)}`)
        units.push('мин')
        seconds = seconds % 60
    }
    if (seconds > 0) {
        numbers.push(`${seconds}`)
        units.push('сек')
    }

    return [ numbers, units ]
}

export function formatDuration(duration: EventDuration): string {
    if (duration === 'unknown') {
        return ''
    }

    function zipNumber(minNumbers: string[], minUnits: string[]) {
        return zip(minNumbers, minUnits).map(([number, unit]) => `${number} ${unit}`).join(' ')
    }

    return duration.map(d => {
        const [minNumbers, minUnits] = formatSingleDuration(d.min)
        const [maxNumbers, maxUnits] = formatSingleDuration(d.max)
        let text

        if (d.max === d.min) {
            text = zipNumber(minNumbers, minUnits)
        } else if (d.min !== undefined && d.max !== undefined) {
            if (minUnits.length === 1 && isEqual(minUnits, maxUnits)) {
                text = `${minNumbers[0]}–${maxNumbers[0]} ${minUnits[0]}`
            } else {
                text = `от ${zipNumber(minNumbers, minUnits)} до ${zipNumber(maxNumbers, maxUnits)}`
            }
        } else if (d.min !== undefined) {
            text = `более ${zipNumber(minNumbers, minUnits)}`
        } else if (d.max !== undefined) {
            text = `до ${zipNumber(maxNumbers, maxUnits)}`
        }

        const title = `${d.title ? `${d.title}: ` : ''}`
        const comment = `${d.comment ? ` (${d.comment})` : ''}`
        return `${title}${text}${comment}`
    }).join(', ')
}