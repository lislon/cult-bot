import { Event } from './app-interfaces'
import { MomentIntervals } from '../lib/timetable/intervals'

export interface DbEvent extends Event {

}

export interface DbEventToUpdate {
    primaryData: DbEvent;
    timeIntervals: MomentIntervals
}