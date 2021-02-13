import { ContextMessageUpdate } from '../../../interfaces/app-interfaces'
import { InlineKeyboardButton } from 'telegraf/typings/telegram-types'
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