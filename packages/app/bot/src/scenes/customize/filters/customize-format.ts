import { ContextMessageUpdate, I18MsgFunction } from '../../../interfaces/app-interfaces'
import { InlineKeyboardButton } from 'typegram'
import { DropdownMenu } from '../dropdown-menu'

export function formatOptionLogic(ctx: ContextMessageUpdate, selected: string) {
    if (ctx.session.customize.format.includes(selected)) {
        ctx.session.customize.format = []
    } else {
        ctx.session.customize.format = [selected]
    }
}

export async function getKeyboardFormat(ctx: ContextMessageUpdate): Promise<InlineKeyboardButton[][]> {
    const menu = new DropdownMenu(ctx, ctx.session.customize.format, ctx.session.customize.openedMenus, 'format_section')

    return [
        [menu.button('online')],
        [menu.button('outdoor')]
    ]
}

export function formatExplainFormat(ctx: ContextMessageUpdate, i18Msg: I18MsgFunction): string[] {
    const {format} = ctx.session.customize
    const formatSection = format.map((o) => i18Msg(ctx, `explain_filter.format_section.${o}`))
    const formatIcon = format.map((o) => i18Msg(ctx, `explain_filter.format_icon.${o}`))
    if (formatSection.length !== 1) {
        return []
    }
    return [i18Msg(ctx, 'explain_filter.format', {
        formatIcon: formatIcon.join(''),
        formatSection: formatSection.join('')
    })]
}