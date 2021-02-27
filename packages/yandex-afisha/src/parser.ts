import Crawler, {CrawlerRequestResponse} from "crawler"
import * as fs from "fs";
import {ParseType} from "./interfaces";
import {dates} from "./settings";



const allData: any[][] = []


const cliArgs = process.argv.slice(2)
console.log(JSON.stringify(cliArgs))

function getParseMode() {
    if (cliArgs[0] === '--snapshot') {
        return 'snapshot'
    } else if (cliArgs[0] === '--orig') {
        return 'orig'
    }
    return undefined
}

const parseTo: ParseType = getParseMode() ?? 'snapshot'
fs.mkdirSync('data', { recursive: true })

const c = new Crawler({
    maxConnections: 1,
    rateLimit: 17 * 1000,
    // This will be called for each crawled page
    callback: function (error: Error, res: CrawlerRequestResponse, done: any) {
        if (error) {
            console.log(error);
        } else {
            // const $ = res.$
            // let $script = $('script[type="application/ld+json"]');
            // let text = $script.text();
            //
            // let data = JSON.parse(text)
            const json = JSON.parse(res.body.toString())
            if (allData[res.options.date] === undefined) {
                allData[res.options.date] = []
            }

            allData[res.options.date] = [...allData[res.options.date], ...json.data]
            console.log(res.options.date + ' ' + `${json.paging.offset} / ${json.paging.total}`)

            for (const [date, values] of Object.entries(allData)) {
                fs.writeFile(`data/yandex-afisha-${date}-${parseTo}.json`, JSON.stringify(values), function (err) {
                    if (err) throw err;
                })
            }

            if (json.paging.offset + json.paging.limit < json.paging.total) {
                c.queue({
                    url: url(json.paging.offset + json.paging.limit, res.options.date),
                    date: res.options.date
                })
            }

            // $ is Cheerio by default
            //a lean implementation of core jQuery designed specifically for the server
            // console.log($("title").text());
        }
        done();
    },
    jQuery: false,
    // debug: true
});

function url(offset: number, date: string) {
    return `https://afisha.yandex.ru/api/events/rubric/main?limit=12&offset=${offset}&hasMixed=0&date=${date}&period=1&city=saint-petersburg&_=1610282462522`
}


// Queue just one URL, with default callback
// c.queue('https://afisha.yandex.ru/saint-petersburg?date=2021-01-16&period=1');
// c.queue('https://www.npmjs.com/package/node-html-crawler');

// Queue URLs with custom callbacks & parameters
for (const date of dates) {
    c.queue({
        url: url(0, date),
        date: date
    })
}