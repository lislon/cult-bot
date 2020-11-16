import { mapUserInputToTimeIntervals } from '../../../src/scenes/customize/customize-utils'
import { interval } from '../../lib/timetable/test-utils'
import { formatExplainTime } from '../../../src/scenes/customize/format-explain'
import { i18n } from '../../../src/util/i18n'
import { ContextMessageUpdate } from '../../../src/interfaces/app-interfaces'
import { parseISO } from 'date-fns'

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
    }
    return formatExplainTime(ctx as ContextMessageUpdate, i18MsgForTest)
}

function i18MsgForTest(id: string, tplData: object = undefined, byDefault: string | null = undefined) {
    const resourceKey = `scenes.customize_scene.${id}`
    if (byDefault === undefined || i18n.resourceKeys('ru').includes(resourceKey)) {
        return i18n.t('ru', resourceKey, tplData)
    } else {
        return byDefault
    }
}

describe('convert_to_intervals', () => {
    const weekends = interval('[2020-01-01 00:00, 2020-01-03 00:00)')

    test.each([
        ['saturday.12:00-15:00', [interval('[2020-01-01 12:00, 2020-01-01 15:00)')]],
        ['sunday.15:00-02:00', [
            interval('[2020-01-02 00:00, 2020-01-02 02:00)'),
            interval('[2020-01-02 15:00, 2020-01-03 00:00)')
        ]],
    ])('%s', (text: string, expected: Interval[]) => {
        const actual = mapUserInputToTimeIntervals([text], weekends)
        expect(actual).toEqual(expected)
    })

    describe('formatExplainTime', () => {
        test('single day', () => {
            const actual = formatExplainTimeEx('2020-01-01 12:00', ['sunday.12:00-14:00'])
            expect(actual).toEqual([
                '🕒 <b>Время</b>:  ВС (05.01): 12.00-14.00',
                ''
            ])
        })

        test('two days simple', () => {
            const actual = formatExplainTimeEx('2020-01-01 12:00', [
                'saturday.12:00-14:00',
                'sunday.12:00-14:00'
            ])
            expect(actual).toEqual([
                '🕒 <b>Время</b>:  СБ (04.01) - ВС (05.01): 12.00-14.00',
                ''
            ])
        })

        test('two days complex', () => {
            const actual = formatExplainTimeEx('2020-01-01 12:00', [
                'saturday.12:00-14:00',
                'sunday.06:00-08:00',
                'sunday.18:00-20:00'
            ])
            expect(actual).toEqual([
                '🕒 <b>Время</b>: ',
                ' - СБ (04.01): 12.00-14.00',
                ' - ВС (05.01): 06.00-08.00, 18.00-20.00',
                ''
            ])
        })

        test('hide past time', () => {
            const actual = formatExplainTimeEx('2020-01-05 12:00', [
                'sunday.06:00-08:00',
                'sunday.18:00-20:00'
            ])
            expect(actual).toEqual([
                '🕒 <b>Время</b>:  ВС (05.01): 18.00-20.00',
                ''
            ])
        })

    })
})
