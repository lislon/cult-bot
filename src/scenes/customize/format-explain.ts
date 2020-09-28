import { ContextMessageUpdate } from '../../interfaces/app-interfaces'
import { getNextWeekEndRange } from '../shared/shared-logic'

function joinTimeIntervals(time: string[], onlyWeekday: 'saturday' | 'sunday') {
    return time
        .sort()
        .map(t => t.split(/[-.]/))
        .filter(([day,]) => day === onlyWeekday)
        .map(([, from, to]) => [+(from.replace(/:.+/, '')), +(to.replace(/:.+/, ''))])
        .reduceRight((acc: number[][], [from, to]) => {
            if (acc.length > 0 && to === acc[0][0]) {
                acc[0][0] = from
            } else {
                acc = [[from, to], ...acc]
            }
            return acc
        }, [])
        .map(([from, to]) => `${from}.00-${to}.00`)
}

export function formatExplainTime(ctx: ContextMessageUpdate, i18Msg: (id: string, tplData?: object) => string): string[] {
    const {time} = ctx.session.customize
    if (time.length === 0) {
        return []
    }
    const lines = []
    const [saturdayTime, sundayTime] = getNextWeekEndRange()
    const weekdays = [
        joinTimeIntervals(time, 'saturday'),
        joinTimeIntervals(time, 'sunday')
    ]
    const moments = [0, 1].map(i => saturdayTime.clone().startOf('day').add(i, 'days').locale('ru'))

    if (weekdays[0].length > 0 && weekdays[1].length > 0 && JSON.stringify(weekdays[0]) !== JSON.stringify(weekdays[1])) {
        lines.push(i18Msg('explain_filter.time'))


        for (let i = 0; i < 2; i++) {
            lines.push(' - ' + i18Msg('explain_filter.time_line', {
                weekday: moments[i].format('dd').toUpperCase(),
                date: moments[i].format('DD.MM'),
                timeIntervals: weekdays[i].join(', ')
            }))
        }
    } else if (weekdays[0].length === 0 || weekdays[1].length === 0) {
        for (let i = 0; i < 2; i++) {
            if (weekdays[i].length > 0) {
                lines.push(i18Msg('explain_filter.time') + ' ' + i18Msg('explain_filter.time_line', {
                    weekday: moments[i].format('dd').toUpperCase(),
                    date: moments[i].format('DD.MM'),
                    timeIntervals: weekdays[i].join(', ')
                })
                )
            }
        }
    } else {
        lines.push(i18Msg('explain_filter.time') + ' ' + i18Msg('explain_filter.time_line', {
            weekday: 'СБ-ВС',
            date: moments.map(t => t.format('DD.MM')).join(','),
            timeIntervals: weekdays[0].join(', ')
        }))
    }
    lines.push('')
    return lines;
}

const MAX_LINE_LEN = 40;

export function formatExplainOblasti(ctx: ContextMessageUpdate, i18Msg: (id: string, tplData?: object) => string): string[] {
    const { oblasti } = ctx.session.customize
    const oblastiNice = oblasti.map(o => i18Msg(`keyboard.oblasti_section.${o}`))
    if (oblastiNice.length === 0) {
        return []
    }
    let lines: string[] = []

    if (oblastiNice.join(', ').length <= MAX_LINE_LEN) {
        lines.push(i18Msg('explain_filter.oblasti') + ' ' + oblastiNice.join(', '))
    } else {
        lines.push(i18Msg('explain_filter.oblasti'))

        lines = [...lines, ...oblastiNice.map(o => {
            return ' - ' + o
        })]
    }
    lines.push('')
    return lines
}



export function formatExplainCennosti(ctx: ContextMessageUpdate, i18Msg: (id: string, tplData?: object) => string): string[] {
    const { cennosti } = ctx.session.customize
    const cennostiNice = cennosti.map(o => i18Msg(`keyboard.cennosti_section.${o}`))
    if (cennostiNice.length === 0) {
        return []
    }
    let lines: string[] = []

    if (cennostiNice.join(', ').length <= MAX_LINE_LEN) {
        lines.push(i18Msg('explain_filter.cennosti') + ' ' + cennostiNice.join(', '))
    } else {
        lines.push(i18Msg('explain_filter.cennosti'))

        lines = [...lines, ...cennostiNice.map(o => {
            return ' - ' + o
        })]
    }
    lines.push('')
    return lines
}