import { ContextMessageUpdate } from '../../interfaces/app-interfaces'
import { i18nSceneHelper } from '../../util/scene-helper'
import { Markup } from 'telegraf'
import {
    getCurPackIndex,
    getEventsCount,
    getPackEventSelected,
    getPacksCount,
    getPacksCurEventIndex,
    getPackSelected,
    getPacksList,
    resetPackIndex,
    resetPacksEventIndex,
    scene
} from './packs-common'
import { cardFormat } from '../shared/card-format'
import { generatePlural, mySlugify, updateMenu } from '../shared/shared-logic'
import emojiRegex from 'emoji-regex'
import { getLikesRow } from '../likes/likes-common'
import { analyticRecordEventView } from '../../lib/middleware/analytics-middleware'


const {actionName, i18Btn, i18Msg, backButton} = i18nSceneHelper(scene)


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
    }, ctx.session.packsScene)
}

export async function displayPackMenu(ctx: ContextMessageUpdate) {
    const pack = await getPackSelected(ctx)
    resetPacksEventIndex(ctx)

    ctx.ua.pv({dp: `/packs/${mySlugify(pack.title)}/`, dt: `Подборки > ${pack.title}`})

    const text = i18Msg(ctx, 'pack_card', {
        title: pack.title,
        description: pack.description,
        eventsPlural: generatePlural(ctx, 'event', pack.events.length)
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
    }, ctx.session.packsScene)
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

    const page = getPacksCurEventIndex(ctx) + 1
    const total = await getEventsCount(ctx)

    // V1:
    // const buttons = [
    //     [
    //         Markup.callbackButton(i18Btn(ctx, 'event_prev') + (page > 1 ? ` ${page}` : ``), actionName(`event_prev`)),
    //         ...getLikesRow(ctx, {
    //             eventId: event.id,
    //             likesCount: event.likes,
    //             dislikesCount: event.dislikes,
    //         }),
    //         Markup.callbackButton((total - page > 0 ? `${total - page} ` : ``) + i18Btn(ctx, 'event_next'), actionName(`event_next`)),
    //     ],
    //     [
    //         Markup.callbackButton(i18Btn(ctx, 'event_back', {
    //             packTitle: packTitleNoEmoji
    //         }), actionName(`event_back`)),
    //     ]
    // ]
    //
    // V2:
    // const buttons = [
    //     [
    //         Markup.callbackButton(i18Btn(ctx, 'event_prev'), actionName(`event_prev`)),
    //         Markup.callbackButton(i18Btn(ctx, 'event_curr', {
    //             page: getCurEventIndex(ctx) + 1,
    //             total: await getEventsCount(ctx)
    //         }), actionName(`event_curr_tip`)),
    //         Markup.callbackButton(i18Btn(ctx, 'event_next'), actionName(`event_next`)),
    //     ],
    //     [
    //         Markup.callbackButton(i18Btn(ctx, 'event_back', {
    //             packTitle: ''
    //         }), actionName(`event_back`)),
    //         ...getLikesRow(ctx, {
    //             eventId: event.id,
    //             likesCount: event.likes,
    //             dislikesCount: event.dislikes,
    //         })
    //     ]
    // ]


    const buttons = [
        [
            Markup.callbackButton(i18Btn(ctx, 'event_prev'), actionName(`event_prev`)),
            ...getLikesRow(ctx, event),
            Markup.callbackButton(i18Btn(ctx, 'event_curr', {
                page: getPacksCurEventIndex(ctx) + 1,
                total: await getEventsCount(ctx)
            }) + ' ' + i18Btn(ctx, 'event_next'), actionName(`event_next`)),
        ],
        [
            Markup.callbackButton(i18Btn(ctx, 'event_back', {
                packTitle: packTitleNoEmoji
            }), actionName(`event_back`)),
        ]
    ]

    await updateMenu(ctx, {
        text: cardFormat(event, {
            showAdminInfo: false,
            packs: true
        }),
        buttons
    }, ctx.session.packsScene)
}