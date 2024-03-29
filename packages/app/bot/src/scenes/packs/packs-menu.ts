import { ContextMessageUpdate } from '../../interfaces/app-interfaces'
import { Markup } from 'telegraf'
import {
    findPackById,
    getPackSelected,
    getPacksList,
    prepareSessionStateIfNeeded,
    resetPacksCache,
    resetSelectedPack,
    scene
} from './packs-common'
import { editMessageAndButtons, EditMessageAndButtonsOptions, generatePlural, mySlugify } from '../shared/shared-logic'
import { logger } from '../../util/logger'
import { db } from '../../database/db'
import { isAdmin } from '../../util/scene-utils'
import { i18nSceneHelper } from '../../util/scene-helper'


const {actionName, i18Btn, i18Msg, backButton} = i18nSceneHelper(scene)


export async function displayMainMenu(ctx: ContextMessageUpdate, options?: EditMessageAndButtonsOptions): Promise<void> {
    const packs = await getPacksList(ctx)
    resetSelectedPack(ctx)
    ctx.ua.pv({dp: `/packs/`, dt: `Подборки`})

    const buttons = [
        ...packs.map(({id, title}) => {
            return [Markup.button.callback(
                i18Btn(ctx, 'single_pack', {title}),
                actionName(`pack_${id}`))]
        }),
        [backButton()]
    ]

    await editMessageAndButtons(ctx, buttons, i18Msg(ctx, 'welcome'), options)
}

export async function displayPackMenu(ctx: ContextMessageUpdate, options?: EditMessageAndButtonsOptions): Promise<void> {
    const pack = await getPackSelected(ctx)
    if (pack === undefined) {
        logger.warn(`Pack id=${ctx.session.packsScene.selectedPackId} is not found. Fallback to pack lists`)
        resetPacksCache(ctx)
        await displayMainMenu(ctx, options)
    } else {

        ctx.ua.pv({dp: `/packs/${mySlugify(pack.title)}/`, dt: `Подборки > ${pack.title}`})

        const text = i18Msg(ctx, 'pack_card', {
            title: pack.title,
            description: pack.description,
            eventsPlural: generatePlural(ctx, 'event', pack.events.length),
            adminInfo: isAdmin(ctx) ? ` <i>(${await db.repoPacks.getPackExtIdId(pack.id)})</i>` : ''
        })


        const buttons = [
            [Markup.button.callback(i18Btn(ctx, 'pack_card_open', {
                packTitle: pack.title
            }), actionName(`pack_open_${pack.id}`))],
            [Markup.button.callback(i18Btn(ctx, 'pack_back'), actionName(`pack_back`))]
        ]

        await editMessageAndButtons(ctx, buttons, text, options)
    }
}

export async function displayPackMenuFromStart(ctx: ContextMessageUpdate, packId: number): Promise<void> {
    prepareSessionStateIfNeeded(ctx)
    ctx.session.packsScene.selectedPackId = packId
    await displayPackMenu(ctx, {
        forceNewMsg: true
    })
    ctx.scene.enter(scene.id, {}, true)
}