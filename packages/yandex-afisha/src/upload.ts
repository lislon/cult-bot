// Require library
import glob from 'glob-promise'
import { dates } from './settings'
import { Place, PlaceWithMeta } from './interfaces'
import { differenceInSeconds, isBefore, parseISO } from 'date-fns'
import * as fs from 'fs'
import { db, pgp } from './database/db'
import { EventsSyncDiff, ExtIdDates, ParsedEventToSave } from './database/parsed-event'
import { ITask } from 'pg-promise'
import { keyBy, Dictionary } from 'lodash'
import { saveCurrentToExcel } from './export-to-excel';
import { authToExcel } from '@culthub/google-docs';

function getParsedDate(file: string): string {
    const m = file.match(/[\d]+-[\d]+-[\d]+/)
    return m ? m[0] : ''
}

function readEventsFromFile(file: string): PlaceWithMeta[] {
    const buffer = fs.readFileSync(file)
    const events = JSON.parse(buffer.toString()) as Place[]
    const parseDate = getParsedDate(file)
    return events.map(e => {
        return {
            ...e,
            parseDate: parseISO(parseDate)
        }
    })
}

async function loadEvents(dates: string[]) {
    const files = (await glob('data/yandex-*.json'))
        .filter(fileName => dates.find(d => fileName.includes(d)))
        .sort()

    return files.flatMap(readEventsFromFile);
}

function mapEvent(e: PlaceWithMeta): ParsedEventToSave {
    const entranceDates = e.scheduleInfo?.dates.map(e => parseISO(parseISO(e).toISOString()))

    function getPrice(e: PlaceWithMeta) {
        if (e.event.tickets[0]?.price) {
            return `${e.event.tickets[0]?.price.min / 100}-${e.event.tickets[0]?.price.max / 100} ${e.event.tickets[0]?.price.currency}`
        } else {
            return `???`;
        }
    }

    return {
        primaryData: {
            extId: e.event.id,
            title: e.event.title,
            category: e.event.type.name,
            description: e.event.argument || '',
            place: e.scheduleInfo?.placePreview || '???',
            tags: e.event.tags.map(t => `#${t.name}`),
            price: getPrice(e),
            entranceDates: entranceDates,
            parseUrl: '???',
            url: `https://afisha.yandex.ru${e.event.url}`,
            deletedAt: null
        }
    }
}

async function enrichEventsWithPastDates(newEvents: ParsedEventToSave[], now: Date, t: ITask<unknown>): Promise<ParsedEventToSave[]> {
    const allExistingDates = await db.repoSync.loadEventEntranceDates(newEvents.map(e => e.primaryData.extId), t)
    const onlyPastDates = allExistingDates
        .map(({ extId, dates }) => ({ extId, dates: dates.filter(d => isBefore(d, now))}))
    const datesByExtId: Dictionary<ExtIdDates> = keyBy<ExtIdDates>(onlyPastDates, 'extId')
    return newEvents.map(e => {
        const pastDates: ExtIdDates = datesByExtId[e.primaryData.extId]
        if (pastDates) {
            return {
                primaryData: {
                    ...e.primaryData,
                    entranceDates: pastDates ? [...pastDates.dates, ...e.primaryData.entranceDates] : e.primaryData.entranceDates
                }
            }
        }
        return e;
    })
}

function isPeriodic(e: ParsedEventToSave): boolean {
    const ed = e.primaryData.entranceDates
    if (ed.length > 30) {
        return true
        // const tail1 = ed[ed.length - 1]
        // const tail2 = ed[ed.length - 2]
        // const tail3 = ed[ed.length - 3]
        // const s1 = differenceInSeconds(tail3, tail2)
        // const s2 = differenceInSeconds(tail2, tail1)
        // if (s1 === s2) {
        //     return true;
        // }
        // return false;
    }
    return false;
}

function filterOnlyRealChange(diff: EventsSyncDiff): EventsSyncDiff {
    return {
        ...diff,
        updated: diff.updated.filter(d => !isPeriodic(d)),
    }
}

function filterOnlyBotSpecificEvents(allEvents: ParsedEventToSave[]): ParsedEventToSave[] {
    return allEvents.filter(e => e.primaryData.category !== 'Квесты')
}

(async function () {
    const allEvents = await loadEvents(dates);
    // const event: PlaceWithMeta = allEvents[0]

    const newEvents: ParsedEventToSave[] = filterOnlyBotSpecificEvents(allEvents.map(mapEvent))

    const diff = await db.task(async (t) => {
        const newEventsWithDates = await enrichEventsWithPastDates(newEvents, new Date(), t)

        const diff = await db.repoSync.prepareDiffForSync(newEventsWithDates, t)
        // return await db.repoSync.syncDiff(diff, t)
        return diff
    })

    const realDiff = filterOnlyRealChange(diff)

    console.log("inserted:")
    console.log(realDiff.inserted.map(e => e.primaryData))
    console.log("updated:")
    console.log(realDiff.updated.map(e => e.primaryData))
    console.log("deleted:")
    console.log(realDiff.deleted)
    console.log("recovered:")
    console.log(realDiff.recovered)

    const excel = await authToExcel()

    await saveCurrentToExcel(excel, newEvents.map(e => e.primaryData), [])
    await db.$pool.end()
    // pgp.end()
})()
