import { parseTimetable } from './parser'

import { db } from '../../db';
import { allCategories, Event } from '../../interfaces/app-interfaces'
import { predictIntervals } from './intervals'
import { mskMoment } from '../../util/moment-msk'
import moment = require('moment')

const csv = require('csv')

moment.updateLocale('en', { week: {
        dow: 1, // First day of week is Monday
        doy: 4  // First week of year must contain 4 January (7 + 1 - 4)
    }});

async function validateDb() {
    const data = await db.any<Event>('' +
        'select * ' +
        'from cb_events ce ')

    const goodTimetables: any = []
    for (const row of data) {
        const timetable = parseTimetable(row.timetable)
        if (timetable.status === true) {
            goodTimetables.push([row, timetable.value])
        }
    }

    const m = mskMoment().startOf('week').startOf('day').add(5, 'd')

    const stats = [];

    console.log(['Date', 'Cat', 'Time #', 'Anytime #'].join('\t'));

    for (let w = 0; w < 5; w++) {

        for (let i = 0; i < 2; i++) {

            const todayStat = new Array(allCategories.length).fill(0)
            const todayStatAny = new Array(allCategories.length).fill(0)


            for (const [row, timetable] of goodTimetables) {
                const intervals = predictIntervals(m, timetable, 1)
                if (intervals.length > 0) {
                    if (timetable.anytime === true) {
                        todayStatAny[allCategories.indexOf(row.category)]++
                    } else {
                        todayStat[allCategories.indexOf(row.category)]++
                    }
                }
            }

            for (let j = 0; j < todayStat.length; j++) {
                const items = [m.format('YYYY-MM-DD'), allCategories[j], todayStat[j], todayStatAny[j], `${todayStat[j]} (+ ${todayStatAny[j]})`]
                console.log(items.join('\t'));
                stats.push(items)
            }

            m.add('1', 'day')
        }
        m.add('1', 'day')
        m.startOf('week')
        m.add(5, 'd')
    }



    return data;
}


(async function run() {
    await validateDb()
})()