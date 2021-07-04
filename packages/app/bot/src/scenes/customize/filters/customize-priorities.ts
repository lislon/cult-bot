import { chidrensTags, ContextMessageUpdate, TagLevel2 } from '../../../interfaces/app-interfaces'
import { DropdownMenu } from '../dropdown-menu'
import { Scenes } from 'telegraf'
import { i18nSceneHelper } from '../../../util/scene-helper'

const scene = new Scenes.BaseScene<ContextMessageUpdate>('customize_scene')
const {revertActionName} = i18nSceneHelper(scene)

export async function customizePriorities(ctx: ContextMessageUpdate) {
    const state = ctx.session.customize
    const menu = new DropdownMenu(ctx, state.priorities, state.openedMenus, 'priorities_section')

    function tagLevel2Btn(btn: TagLevel2) {
        return [menu.button(btn)]
    }

    const buttons = [
        ...(menu.dropDownButtons('menu_childrens', [chidrensTags])),
        ...(menu.dropDownButtons('menu_cost', [['#бесплатно', '#доступноподеньгам', '#_недешево']])),
        tagLevel2Btn('#комфорт'),
        tagLevel2Btn('#премьера'),
        tagLevel2Btn('#навоздухе'),
        tagLevel2Btn('#компанией'),
        tagLevel2Btn('#новыеформы'),
        tagLevel2Btn('#успетьзачас'),
        tagLevel2Btn('#_последнийшанс'),
        tagLevel2Btn('#культурныйбазис'),
    ]
    return buttons
}

export function prioritiesOptionLogic(ctx: ContextMessageUpdate, selected: string) {
    const tag = revertActionName(selected) as TagLevel2
    if (ctx.session.customize.priorities.includes(tag)) {
        ctx.session.customize.priorities = ctx.session.customize.priorities.filter(s => s !== tag)
    } else {
        if (chidrensTags.includes(tag)) {
            ctx.session.customize.priorities = ctx.session.customize.priorities.filter(s => !chidrensTags.includes(s))
        }
        ctx.session.customize.priorities.push(tag)
    }
}