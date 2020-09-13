import { cleanText } from './timetable-utils'
import { predictIntervals } from './intervals';
import { parseTimetable } from './parser'
import moment = require('moment')
import { loadTop5Events } from '../../scenes/list/repo'

import { db } from '../../db';
import { Event } from '../../interfaces/app-interfaces'
import dbsync from '../../dbsync/dbsync'


async function validateDb() {
    const data = await db.any<Event>('' +
        'select timetable ' +
        'from cb_events ce ')

    for (const row of data) {
        const timetable = parseTimetable(row.timetable)
        if (timetable.status === false) {
            console.log('>>>> ' + row.timetable)
            console.log(timetable.error)
        }
    }

    return data;
}


(async function run() {
    await validateDb()
})()