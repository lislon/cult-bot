import { ContextMessageUpdate } from '../../interfaces/app-interfaces'
import { i18nSceneHelper } from '../../util/scene-helper'
import { Markup } from 'telegraf'
import {
    getCurEventIndex,
    getCurPackIndex,
    getEventsCount,
    getEventSelected,
    getPacksCount,
    getPackSelected,
    getPacksList,
    resetEventIndex,
    resetPackIndex,
    scene,
    updateMenu
} from './packs-common'
import { cardFormat } from '../shared/card-format'
import slugify from 'slugify'


const {sceneHelper, actionName, i18nModuleBtnName, i18Btn, i18Msg, backButton} = i18nSceneHelper(scene)


export async function displayMainMenu(ctx: ContextMessageUpdate) {
    const packs = await getPacksList(ctx)
    resetPackIndex(ctx)
    ctx.ua.pv({dp: `/packs/`, dt: `Подборки`})

    const buttons = [
        ...packs.map(({id, title}, idx) => {
            return [Markup.callbackButton(
                i18Btn(ctx, 'single_pack', {title}),
                actionName(`pack_${idx}`))]
        }),
        [backButton(ctx)]
    ]

    await updateMenu(ctx, {
        text: i18Msg(ctx, 'welcome'),
        buttons
    })
}

export function mySlugify(text: string) {
    return slugify(text, {
        lower: true,
        strict: true
    })
}

export async function displayPackMenu(ctx: ContextMessageUpdate) {
    const pack = await getPackSelected(ctx)
    resetEventIndex(ctx)

    ctx.ua.pv({dp: `/packs/${mySlugify(pack.title)}/`, dt: `Подборки > ${pack.title}`})

    const text = i18Msg(ctx, 'pack_card', {
        title: pack.title,
        description: pack.description,
        listOfEvents: pack.events
            .map(({title}) => i18Msg(ctx, 'pack_card_event', {title}))
            .join('\n')
    })

    const buttons = [
        [
            Markup.callbackButton(i18Btn(ctx, 'pack_card_open', {
                packTitle: pack.title
            }), actionName(`pack_open`))
        ],
        [
            Markup.callbackButton(i18Btn(ctx, 'pack_next', {
                page: getCurPackIndex(ctx) + 1,
                total: await getPacksCount(ctx)
            }), actionName(`pack_next`))
        ],
        [
            Markup.callbackButton(i18Btn(ctx, 'pack_back'), actionName(`pack_back`)),
        ]
    ]

    await updateMenu(ctx, {
        text: text,
        buttons
    })
}

export async function displayEventsMenu(ctx: ContextMessageUpdate) {
    const pack = await getPackSelected(ctx)
    const event = await getEventSelected(ctx)

    ctx.ua.pv({dp: `/packs/${mySlugify(pack.title)}/${mySlugify(event.ext_id)}`, dt: `Подборки > ${pack.title} > ${event.title}`})

    const buttons = [
        [
            Markup.callbackButton(i18Btn(ctx, 'event_prev'), actionName(`event_prev`)),
            Markup.callbackButton(i18Btn(ctx, 'event_curr', {
                page: getCurEventIndex(ctx) + 1,
                total: await getEventsCount(ctx)
            }), actionName(`event_curr_tip`)),
            Markup.callbackButton(i18Btn(ctx, 'event_next'), actionName(`event_next`)),
        ],
        [
            Markup.callbackButton(i18Btn(ctx, 'event_back', {
                packTitle: pack.title
            }), actionName(`event_back`)),
        ]
    ]

    await updateMenu(ctx, {
        text: cardFormat(event, {
            showAdminInfo: false,
            packs: true
        }),
        buttons
    })
}