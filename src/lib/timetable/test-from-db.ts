import { parseTimetable } from './parser'

import { db } from '../../db';
import { Event } from '../../interfaces/app-interfaces'


async function validateDb() {
    const data = await db.any<Event>('' +
        'select timetable ' +
        'from cb_events ce ')

    for (const row of data) {
        const timetable = parseTimetable(row.timetable)
        if (timetable.status === false) {
            console.log('>>>> ' + row.timetable)
            console.log(timetable.errors)
        }
    }

    return data;
}


(async function run() {
    await validateDb()
})()