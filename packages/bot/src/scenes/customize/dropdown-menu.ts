import { ContextMessageUpdate } from '../../interfaces/app-interfaces'
import { InlineKeyboardButton } from 'typegram'
import { checkboxi18nBtnId } from '../shared/shared-logic'
import { Markup, Scenes } from 'telegraf'
import { i18nSceneHelper } from '../../util/scene-helper'

const scene = new Scenes.BaseScene<ContextMessageUpdate>('customize_scene')

const {backButton, actionName, i18nModuleBtnName, revertActionName, scanKeys, i18nSharedBtnName, i18Btn} = i18nSceneHelper(scene)

export type SectionName = 'rubrics_section' | 'priorities_section' | 'time_section' | 'format_section'

export class DropdownMenu {
    private readonly selected: string[]
    private readonly openedMenus: string[]
    private readonly ctx: ContextMessageUpdate
    private readonly section: SectionName

    constructor(ctx: ContextMessageUpdate,
                selected: string[],
                openedMenus: string[],
                section: SectionName) {
        this.selected = selected
        this.openedMenus = openedMenus
        this.ctx = ctx
        this.section = section
    }

    button(actionName: string, title?: string): InlineKeyboardButton {
        const isSelected = this.selected.includes(actionName)
        const text = (title ?? i18Btn(this.ctx, `${this.section}.${actionName}`)) + checkboxi18nBtnId(this.ctx, isSelected)
        return Markup.button.callback(text, this.actionName(`${actionName}`))
    }

    private actionName(postfix: string) {
        switch (this.section) {
            case 'priorities_section':
                return actionName(`p_${postfix}`)
            case 'rubrics_section':
                return actionName(`o_${postfix}`)
            case 'time_section':
                return actionName(`t_${postfix}`)
            case 'format_section':
                return actionName(`f_${postfix}`)
            default:
                throw new Error(`Unknown section name ${this.section}`)
        }
    }

    dropDownButtons(menuTitle: string, submenus: string[][], menuTitleData = {}, menuId = menuTitle): InlineKeyboardButton[][] {
        const decorateTag = (tag: string) => ['rubrics_section'].includes(this.section)
            ? `${menuId.replace('menu_', '')}.${tag}`
            : tag

        const isAnySubmenuSelected = submenus
            .flatMap(m => m)
            .find(tag => this.selected.includes(decorateTag(tag))) !== undefined

        const menuTitleWord = i18Btn(this.ctx, `${this.section}.${menuTitle}`, menuTitleData)
        const isOpen = this.openedMenus.includes(menuId)
        const menuTitleFull = i18Btn(this.ctx, `menu_${isOpen ? 'open' : 'closed'}`, {
            title: menuTitleWord,
            checkbox: checkboxi18nBtnId(this.ctx, isAnySubmenuSelected),
        })
        const map: InlineKeyboardButton[][] = isOpen ? submenus
                .map(rows => rows
                    .map(tag => {
                        if (this.section === 'time_section') {
                            return this.button(decorateTag(tag), i18Btn(this.ctx, `${this.section}.date_title.${tag.substring('yyyy-MM-dd.'.length)}`))
                        } else {
                            return this.button(decorateTag(tag))
                        }
                    }))
            : []

        return [
            [Markup.button.callback(menuTitleFull, this.actionName(menuId))],
            ...map
        ]
    }

}