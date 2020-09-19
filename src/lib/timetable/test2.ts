import { predictIntervals } from './intervals';
import { parseTimetable } from './parser'
import { mskMoment } from '../../util/moment-msk'

const timetable = parseTimetable('в любое время')
// console.log(JSON.stringify(timetable, undefined, 2));
if (timetable.status === true) {
    console.log(JSON.stringify(predictIntervals(mskMoment('2020-01-01 00:00:00'), timetable.value)));
} else {
    console.log('fail')
}