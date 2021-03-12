import Crawler, { CrawlerRequestResponse } from 'crawler'
import { PlaceWithMeta } from '../interfaces'
import { ParsedEventToSave } from '../database/parsed-event'
import { format, formatISO, parseISO } from 'date-fns'

import debugNamespace from 'debug'
import { appConfig } from '../app-config'
import { datesToTimetable } from './dates-to-timetable'
import fs from 'fs'

const debug = debugNamespace('yandex-parser')

export interface ParseAfishaOptions {
    limitEvents?: number
    snapshotDirectory?: string
}

export async function afishaDownload(dates: Date[], options: ParseAfishaOptions = { }): Promise<ParsedEventToSave[]> {
    if (options.snapshotDirectory !== undefined) {
        fs.mkdirSync(options.snapshotDirectory, {recursive: true})
    }

    return new Promise((resolve => {
        let allData: unknown[] = [];

        const c = new Crawler({
            maxConnections: 1,
            rateLimit: appConfig.SECONDS_PER_PAGE * 1000,
            // This will be called for each crawled page
            callback: function (error: Error, res: CrawlerRequestResponse, done: () => void) {
                if (error) {
                    console.error(error);
                } else {
                    // const $ = res.$
                    // let $script = $('script[type="application/ld+json"]');
                    // let text = $script.text();
                    //
                    // let data = JSON.parse(text)

                    const json = JSON.parse(res.body.toString())

                    allData = [...allData, ...json.data]

                    const {offset, limit, total } = json.paging

                    if (offset + limit < total) {
                        debug(`parsed ${formatISO(res.options.date)} ${offset} / ${total}`)
                        if (options.limitEvents !== undefined && allData.length < options.limitEvents) {
                            debug(`queue offset ${offset + limit}`)
                            c.queue({
                                url: url(offset + limit, formatISO(res.options.date, { representation: 'date' })),
                                date: res.options.date
                            })
                        } else {
                            debug(`basta options.limitEvents = ${options.limitEvents}`)
                        }
                    }
                }
                debug(`parsing done ${formatISO(res.options.date)}. Total = ${allData.length} events`)
                done()
            },
            jQuery: false,
            // debug: true
        });

        dates.forEach(date => {
            c.queue({
                url: url(0, formatISO(date, { representation: 'date' })),
                date: date
            })
        })

        c.on('drain', () => {

            const resultsById: Map<string, ParsedEventToSave> = new Map<string, ParsedEventToSave>()
            const events = allData.map((x: PlaceWithMeta) => mapEvent(x, ``)) as ParsedEventToSave[]
            for (const event of events) {
                resultsById.set(event.primaryData.extId, event)
            }

            if (options.snapshotDirectory !== undefined) {
                const dateRange = `${format(dates[0], 'dd.MM')}-${format(dates[dates.length - 1], 'dd.MM')}`
                const parseDate = `${format(new Date(), 'yyyy-MM-dd')}`
                const filename = `parse-at-${parseDate}-range-from-${dateRange}-to-${parseDate}.json`
                fs.writeFileSync(`${options.snapshotDirectory}/${filename}`, JSON.stringify(allData, undefined, 4))
            }

            resolve(Array.from(resultsById.values()))
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
            return `???`
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
            timetable: timetable,
            parseUrl: parsedUrl,
            url: `https://afisha.yandex.ru${e.event.url}`,
            updatedAt: null,
            deletedAt: null,
        },
        rawDates: e.scheduleInfo?.dates
    }
}