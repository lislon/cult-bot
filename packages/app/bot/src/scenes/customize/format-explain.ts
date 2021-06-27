import { ContextMessageUpdate, I18MsgFunction } from '../../interfaces/app-interfaces'
import { MAX_EXPLAIN_LINE_LEN } from './customize-common'

export function formatExplainRubrics(ctx: ContextMessageUpdate, i18Msg: I18MsgFunction): string[] {
    const {rubrics} = ctx.session.customize
    const rubricsNice = rubrics.map((o) =>
        i18Msg(ctx, `explain_filter.rubrics_section.${o}`, {}, i18Msg(ctx, `keyboard.rubrics_section.${o}`))
    )
    if (rubricsNice.length === 0) {
        return []
    }
    let lines: string[] = []

    if (rubricsNice.join(', ').length <= MAX_EXPLAIN_LINE_LEN) {
        lines.push(i18Msg(ctx, 'explain_filter.rubrics') + ' ' + rubricsNice.join(', '))
    } else {
        lines.push(i18Msg(ctx, 'explain_filter.rubrics'))

        lines = [
            ...lines,
            ...rubricsNice.map((o) => {
                return ' - ' + o
            }),
        ]
    }
    return lines
}

export function formatExplainPriorities(ctx: ContextMessageUpdate, i18Msg: I18MsgFunction): string[] {
    const {priorities} = ctx.session.customize
    const prioritiesNice = priorities.map((o) =>
        i18Msg(ctx, `explain_filter.priorities_section.${o}`, {}, i18Msg(ctx, `keyboard.priorities_section.${o}`))
    )
    if (prioritiesNice.length === 0) {
        return []
    }
    let lines: string[] = []

    if (prioritiesNice.join(', ').length <= MAX_EXPLAIN_LINE_LEN) {
        lines.push(i18Msg(ctx, 'explain_filter.priorities') + ' ' + prioritiesNice.join(', '))
    } else {
        lines.push(i18Msg(ctx, 'explain_filter.priorities'))

        lines = [
            ...lines,
            ...prioritiesNice.map((o) => {
                return ' - ' + o
            }),
        ]
    }
    return lines
}

