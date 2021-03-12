import { addDays, startOfDay, startOfISOWeek } from 'date-fns/fp'
import flow from 'lodash/fp/flow'

export function getNextWeekendDates(now: Date): Date[] {
    return [flow(startOfISOWeek, startOfDay, addDays(5))(now), flow(startOfISOWeek, startOfDay, addDays(6))(now)]
}
