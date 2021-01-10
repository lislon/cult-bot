import { ContextMessageUpdate } from '../../../interfaces/app-interfaces'
import { DropdownMenu } from '../dropdown-menu'
import { BaseScene } from 'telegraf'
import { i18nSceneHelper } from '../../../util/scene-helper'

const scene = new BaseScene<ContextMessageUpdate>('customize_scene')

const {backButton, actionName, i18nModuleBtnName, revertActionName, scanKeys, i18nSharedBtnName, i18Btn, i18Msg, i18SharedBtn} = i18nSceneHelper(scene)

export async function customizeOblasti(ctx: ContextMessageUpdate) {
    const menu = new DropdownMenu(ctx, ctx.session.customize.oblasti, ctx.session.customize.openedMenus, 'oblasti_section')

    const getSectionFromI18n = (section: string): [string][] => {
        return scanKeys(`keyboard.oblasti_section.${section}`).map(t => [t.replace(/^[^#]+/, '')])
    }

    const buttons = [
        ...(menu.dropDownButtons('menu_movies',
            getSectionFromI18n(`movies`)
        )),
        ...(menu.dropDownButtons('menu_concerts',
            getSectionFromI18n(`concerts`)
        )),
        ...(menu.dropDownButtons('menu_exhibitions_perm',
            getSectionFromI18n(`exhibitions_perm`)
        )),
        ...(menu.dropDownButtons('menu_exhibitions_temp',
            getSectionFromI18n(`exhibitions_temp`)
        )),
        ...(menu.dropDownButtons('menu_theaters',
            getSectionFromI18n(`theaters`)
        )),
        ...(menu.dropDownButtons('menu_events',
            getSectionFromI18n(`events`)
        )),
        ...(menu.dropDownButtons('menu_walks',
            getSectionFromI18n('walks')
        ))
    ]
    return buttons
}

export function oblastiOptionLogic(ctx: ContextMessageUpdate, selected: string) {
    const [cat, tag] = selected.split('.')
    const tagRus = `${cat}.${revertActionName(tag)}`
    if (ctx.session.customize.oblasti.includes(tagRus)) {
        ctx.session.customize.oblasti = ctx.session.customize.oblasti.filter(s => s !== tagRus)
    } else {
        ctx.session.customize.oblasti.push(tagRus)
    }
}

export function cleanOblastiTag(oblasti: string[]) {
    return oblasti
        .flatMap(o => {
            if (o === 'exhibitions_perm.#научнотехнические') {
                return [
                    'exhibitions.#наука',
                    'exhibitions.#техника',
                ]
            }
            return [o]
        })
        .map(o => o.replace(/_.+[.]#/, '.#')) //  "exhibitions_perm.#историколитературные" ->   "exhibitions.#историколитературные"
}