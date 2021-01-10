import { chidrensTags, ContextMessageUpdate, TagLevel2 } from '../../../interfaces/app-interfaces'
import { DropdownMenu } from '../dropdown-menu'
import { i18nSceneHelper } from '../../../util/scene-helper'
import { BaseScene } from 'telegraf'

const scene = new BaseScene<ContextMessageUpdate>('customize_scene')
const {backButton, actionName, i18nModuleBtnName, revertActionName, scanKeys, i18nSharedBtnName, i18Btn, i18Msg, i18SharedBtn} = i18nSceneHelper(scene)

export async function customizeCennosti(ctx: ContextMessageUpdate) {
    const state = ctx.session.customize
    const menu = new DropdownMenu(ctx, state.cennosti, state.openedMenus, 'cennosti_section')

    const buttons = [
        ...(menu.dropDownButtons('menu_childrens', [chidrensTags])),
        ...(menu.dropDownButtons('menu_cost', [['#бесплатно', '#доступноподеньгам', '#_недешево']])),
        [menu.button('#комфорт')],
        [menu.button('#премьера')],
        [menu.button('#навоздухе')],
        [menu.button('#компанией')],
        [menu.button('#ЗОЖ')],
        [menu.button('#новыеформы')],
        [menu.button('#успетьзачас')],
        [menu.button('#культурныйбазис')],
    ]
    return buttons
}

export function cennostiOptionLogic(ctx: ContextMessageUpdate, selected: string) {
    const tag = revertActionName(selected) as TagLevel2
    if (ctx.session.customize.cennosti.includes(tag)) {
        ctx.session.customize.cennosti = ctx.session.customize.cennosti.filter(s => s !== tag)
    } else {
        if (chidrensTags.includes(tag)) {
            ctx.session.customize.cennosti = ctx.session.customize.cennosti.filter(s => !chidrensTags.includes(s))
        }
        ctx.session.customize.cennosti.push(tag)
    }
}