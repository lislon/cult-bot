import { mapUserInputToTimeIntervals } from '../../../src/scenes/customize/customize-utils'
import { mkInterval } from '../../util/timetable-util'
import { i18n } from '../../../src/util/i18n'
import { ContextMessageUpdate, I18MsgFunction, DateInterval } from '../../../src/interfaces/app-interfaces'
import { parseISO } from 'date-fns'
import { formatExplainTime } from '../../../src/scenes/customize/filters/customize-time'

function formatExplainTimeEx(now: string, time: string[]): string[] {
    const ctx: Pick<ContextMessageUpdate, 'i18n' | 'now' | 'session'> = {
        i18n: i18n,
        now(): Date {
            return parseISO(now)
        },
        session: {
            customize: {
                time: time,
            }
        } as any
    } as ContextMessageUpdate

    const i18Msg: I18MsgFunction = function (ctx: ContextMessageUpdate, id: string, tplData: any = undefined, byDefault: string | null = undefined) {
        const resourceKey = `scenes.customize_scene.${id}`
        if (byDefault === undefined || i18n.resourceKeys('ru').includes(resourceKey)) {
            return i18n.t('ru', resourceKey, tplData)
        } else {
            return byDefault
        }
    }

    return formatExplainTime(ctx as ContextMessageUpdate, i18Msg)
}

describe('convert_to_intervals', () => {
    const expectedInterval = mkInterval
    const weekendsInterval = mkInterval


    test.each([
        ['2020-01-04.12:00-15:00',
            weekendsInterval('[2020-01-04 00:00, 2020-01-06 00:00)'),
            [expectedInterval('[2020-01-04 12:00, 2020-01-04 15:00)')]],
        ['2020-01-04.12:00-15:00',
            weekendsInterval('[2020-01-04 13:00, 2020-01-06 00:00)'),
            [expectedInterval('[2020-01-04 13:00, 2020-01-04 15:00)')]],
        ['2020-01-05.20:00-24:00',
            weekendsInterval('[2020-01-05 10:00, 2020-01-06 00:00)'),
            [
                expectedInterval('[2020-01-05 20:00, 2020-01-06 00:00)')
            ]],
    ])('%s', (text: string, weekends: DateInterval, expected: Interval[]) => {
        const actual = mapUserInputToTimeIntervals([text], weekends)
        expect(actual).toEqual(expected)
    })

    describe('formatExplainTime', () => {
        test('single day', () => {
            const actual = formatExplainTimeEx('2020-01-01 12:00', ['2020-01-05.12:00-14:00'])
            expect(actual).toEqual([
                '🕒 <b>Время</b>:  ВС (05.01): 12.00-14.00'
            ])
        })

        test('two days simple', () => {
            const actual = formatExplainTimeEx('2020-01-01 12:00', [
                '2020-01-04.12:00-14:00',
                '2020-01-05.12:00-14:00'
            ])
            expect(actual).toEqual([
                '🕒 <b>Время</b>: ',
                ' - СБ (04.01): 12.00-14.00',
                ' - ВС (05.01): 12.00-14.00',
            ])
        })

        test('two days complex', () => {
            const actual = formatExplainTimeEx('2020-01-01 12:00', [
                '2020-01-04.12:00-14:00',
                '2020-01-05.06:00-08:00',
                '2020-01-05.18:00-20:00'
            ])
            expect(actual).toEqual([
                '🕒 <b>Время</b>: ',
                ' - СБ (04.01): 12.00-14.00',
                ' - ВС (05.01): 06.00-08.00, 18.00-20.00'
            ])
        })

        test('hide past time', () => {
            const actual = formatExplainTimeEx('2020-01-05 12:00', [
                '2020-01-05.06:00-08:00',
                '2020-01-05.18:00-20:00'
            ])
            expect(actual).toEqual([
                '🕒 <b>Время</b>:  ВС (05.01): 18.00-20.00'
            ])
        })

    })
})
