import { cleanText } from './timetable-utils'
import { predictIntervals } from './intervals';
import { parseTimetable } from './parser'
import moment = require('moment')

const timetable = parseTimetable('в любое время')
// console.log(JSON.stringify(timetable, undefined, 2));
console.log(JSON.stringify(predictIntervals(moment('2020-01-01 00:00:00'), timetable.value)));