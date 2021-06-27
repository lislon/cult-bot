import Crawler, { CrawlerRequestResponse } from 'crawler'
import { PlaceWithMeta } from '../interfaces'
import { ParsedEventToSave } from '../database/parsed-event'
import { format, formatISO, parseISO } from 'date-fns'

import debugNamespace from 'debug'
import { appConfig } from '../app-config'
import { datesToTimetable } from './dates-to-timetable'
import fs from 'fs'
import { logger } from '../logger'
import { EventCategory } from '@culthub/interfaces'

const debug = debugNamespace('yandex-parser:download')

export interface ParseAfishaOptions {
    limitEvents?: number
    snapshotDirectory?: string
}

export async function afishaDownload(dates: Date[], options: ParseAfishaOptions = {}): Promise<ParsedEventToSave[]> {
    const now = new Date()

    if (options.snapshotDirectory !== undefined) {
        fs.mkdirSync(options.snapshotDirectory, {recursive: true})
    }
    if (fs.existsSync(getCacheFilePath())) {
        debug(`Do not download. Use cached file ${getCacheFilePath()}`)
        const string = fs.readFileSync(getCacheFilePath(), {encoding: 'utf-8'})
        return convertRawDataToFinalResult(JSON.parse(string))
    }

    function getCacheFilePath() {
        const dateRange = `${format(dates[0], 'dd.MM')}-${format(dates[dates.length - 1], 'dd.MM')}`
        const parseDate = `${format(now, 'yyyy-MM-dd')}`
        const filename = `parse-at-${parseDate}-range-from-${dateRange}-to-${parseDate}.json`
        return `${options.snapshotDirectory}/${filename}`
    }

    function convertRawDataToFinalResult(allData: unknown[]) {
        const resultsById: Map<string, ParsedEventToSave> = new Map<string, ParsedEventToSave>()
        const events = allData.map((x: PlaceWithMeta) => mapEvent(x, ``)) as ParsedEventToSave[]
        for (const event of events) {
            resultsById.set(event.primaryData.extId, event)
        }

        return Array.from(resultsById.values())
    }

    return new Promise((resolve => {
        let allData: unknown[] = []

        const c = new Crawler({
            maxConnections: 1,
            rateLimit: appConfig.SECONDS_PER_PAGE * 1000,
            // This will be called for each crawled page
            callback: function (error: Error, res: CrawlerRequestResponse, done: () => void) {
                if (error) {
                    console.error(error)
                } else {
                    // const $ = res.$
                    // let $script = $('script[type="application/ld+json"]');
                    // let text = $script.text();
                    //
                    // let data = JSON.parse(text)

                    const json = JSON.parse(res.body.toString())

                    if (json.data === undefined) {
                        return
                    }
                    try {
                        allData = [...allData, ...json.data]
                    } catch (e) {
                        console.log(e)
                        return
                    }

                    const {offset, limit, total} = json.paging

                    if (offset + limit < total) {
                        debug(`parsed ${formatISO(res.options.date)} ${offset} / ${total} (limit = ${options.limitEvents ?? 'not-defined'})`)
                        if (options.limitEvents === undefined || allData.length < options.limitEvents) {
                            const nextUrl = url(offset + limit, formatISO(res.options.date, {representation: 'date'}))
                            debug(`queue next URL ${nextUrl}`)
                            c.queue({
                                url: nextUrl,
                                date: res.options.date
                            })
                        }
                    }
                }
                debug(`parsing done ${formatISO(res.options.date)}. Total = ${allData.length} events`)
                done()
            },
            jQuery: false,
            // debug: true
        })

        dates.forEach(date => {
            c.queue({
                url: url(0, formatISO(date, {representation: 'date'})),
                date: date
            })
        })

        c.on('drain', () => {

            if (options.snapshotDirectory !== undefined) {
                fs.writeFileSync(getCacheFilePath(), JSON.stringify(allData, undefined, 4))
                logger.info(`Saved RAW data to ${getCacheFilePath()}`)
            }

            resolve(convertRawDataToFinalResult(allData))
        })
    }))
}

function url(offset: number, date: string) {
    return `https://afisha.yandex.ru/api/events/rubric/main?limit=12&offset=${offset}&hasMixed=0&date=${date}&period=1&city=saint-petersburg&_=1610282462522`
}


export function mapEvent(e: PlaceWithMeta, parsedUrl: string): ParsedEventToSave {
    const timetable = datesToTimetable(e.scheduleInfo?.dates.map(e => parseISO(parseISO(e).toISOString())))

    function getPrice(e: PlaceWithMeta) {
        if (e.event.tickets[0]?.price) {
            return `${e.event.tickets[0]?.price.min / 100}-${e.event.tickets[0]?.price.max / 100} ${e.event.tickets[0]?.price.currency}`
        } else {
            return ``
        }
    }

    return {
        primaryData: {
            extId: e.event.id,
            title: e.event.title,
            category: e.event.type.name,
            description: e.event.argument || '',
            place: e.scheduleInfo?.placePreview || '',
            tags: e.event.tags.map(t => `#${t.name}`).sort(),
            price: getPrice(e),
            timetable: timetable,
            parseUrl: parsedUrl,
            url: `https://afisha.yandex.ru${e.event.url}`
        },
        rawDates: e.scheduleInfo?.dates
    }
}

export function toBotCategory(yandexCategory: string): EventCategory {
    switch (yandexCategory) {
        case 'Выставка':
            return 'exhibitions'
        case 'Кино':
            return 'movies'
        case 'Концерт':
            return 'concerts'
        case 'Театр':
            return 'theaters'
        case 'другое':
            return 'walks'

    }
    return 'events'
}