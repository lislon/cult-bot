import { ContextMessageUpdate } from '../../interfaces/app-interfaces'
import { i18nSceneHelper } from '../../util/scene-helper'
import { Markup } from 'telegraf'
import {
    getEventsCount,
    getPackEventSelected,
    getPacksCurEventIndex,
    getPackSelected,
    getPacksList,
    resetPackIndex,
    resetPacksEventIndex,
    scene
} from './packs-common'
import { cardFormat } from '../shared/card-format'
import { editMessageAndButtons, EditMessageAndButtonsOptions, generatePlural, mySlugify } from '../shared/shared-logic'
import emojiRegex from 'emoji-regex'
import { getLikesRow } from '../likes/likes-common'
import { analyticRecordEventView } from '../../lib/middleware/analytics-middleware'


const {actionName, i18Btn, i18Msg, backButton} = i18nSceneHelper(scene)


export async function displayMainMenu(ctx: ContextMessageUpdate, options?: EditMessageAndButtonsOptions) {
    const packs = await getPacksList(ctx)
    resetPackIndex(ctx)
    ctx.ua.pv({dp: `/packs/`, dt: `Подборки`})

    const buttons = [
        ...packs.map(({id, title}, idx) => {
            return [Markup.button.callback(
                i18Btn(ctx, 'single_pack', {title}),
                actionName(`pack_${idx}`))]
        }),
        [backButton()]
    ]

    await editMessageAndButtons(ctx, buttons, i18Msg(ctx, 'welcome'), options)
}

export async function displayPackMenu(ctx: ContextMessageUpdate, options?: EditMessageAndButtonsOptions) {
    const pack = await getPackSelected(ctx)
    resetPacksEventIndex(ctx)

    ctx.ua.pv({dp: `/packs/${mySlugify(pack.title)}/`, dt: `Подборки > ${pack.title}`})

    const text = i18Msg(ctx, 'pack_card', {
        title: pack.title,
        description: pack.description,
        eventsPlural: generatePlural(ctx, 'event', pack.events.length)
    })

    const buttons = [
        [Markup.button.callback(i18Btn(ctx, 'pack_card_open', {
            packTitle: pack.title
        }), actionName(`pack_open`))],
        [Markup.button.callback(i18Btn(ctx, 'pack_back'), actionName(`pack_back`))]
    ]

    await editMessageAndButtons(ctx, buttons, text, options)
}

export async function displayEventsMenu(ctx: ContextMessageUpdate) {
    const pack = await getPackSelected(ctx)
    const event = await getPackEventSelected(ctx)

    const packTitleNoEmoji = pack.title.replace(emojiRegex(), '').trim()

    ctx.ua.pv({
        dp: `/packs/${mySlugify(packTitleNoEmoji)}/${mySlugify(event.ext_id)}`,
        dt: `Подборки > ${packTitleNoEmoji} > ${event.title}`
    })
    analyticRecordEventView(ctx, event)

    const buttons = [
        [
            Markup.button.callback(i18Btn(ctx, 'event_back', {
                packTitle: packTitleNoEmoji
            }), actionName(`event_back`)),
            ...getLikesRow(ctx, event)
        ],
        [
            Markup.button.callback(i18Btn(ctx, 'event_prev'), actionName(`event_prev`)),
            Markup.button.callback(i18Btn(ctx, 'event_curr', {
                page: getPacksCurEventIndex(ctx) + 1,
                total: await getEventsCount(ctx)
            }), actionName(`event_curr`)),
            Markup.button.callback(i18Btn(ctx, 'event_next'), actionName(`event_next`)),
        ]
    ]

    await editMessageAndButtons(ctx, {
        text: cardFormat(event, {
            showAdminInfo: false,
            packs: true
        }),
        buttons
    }.buttons, {
        text: cardFormat(event, {
            showAdminInfo: false,
            packs: true
        }),
        buttons
    }.text)
}