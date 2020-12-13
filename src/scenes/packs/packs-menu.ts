import { ContextMessageUpdate } from '../../interfaces/app-interfaces'
import { i18nSceneHelper } from '../../util/scene-helper'
import { db } from '../../database/db'
import { Markup } from 'telegraf'
import { createReadStream } from 'fs'
import path from 'path'
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


const {sceneHelper, actionName, i18nModuleBtnName, i18Btn, i18Msg, backButton} = i18nSceneHelper(scene)


export async function displayMainMenu(ctx: ContextMessageUpdate) {
    const packs = await getPacksList(ctx)
    resetPackIndex(ctx)

    const buttons = [
        ...packs.map(({id, title}, idx) => {
            return [Markup.callbackButton(
                i18Btn(ctx, 'single_pack', {title}),
                actionName(`pack_${idx}`))]
        }),
        [backButton(ctx)]
    ]

    await updateMenu(ctx, {
        imgCacheId: 'podborka.png',
        imgLoad: async () => {
            return {
                source: createReadStream(path.resolve(__dirname, './assets/podborka.png'))
            }
        },
        text: i18Msg(ctx, 'welcome'),
        buttons
    })
}

export async function displayPackMenu(ctx: ContextMessageUpdate) {
    const pack = await getPackSelected(ctx)
    resetEventIndex(ctx)

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
        imgCacheId: pack.imageSrc,
        imgLoad: async () => {
            return {
                source: await db.repoPacks.loadImage(pack.id)
            }
        },
        text: text,
        buttons
    })
}



export async function displayEventsMenu(ctx: ContextMessageUpdate) {
    const pack = await getPackSelected(ctx)
    const event = await getEventSelected(ctx)

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
        imgCacheId: pack.imageSrc,
        imgLoad: async () => {
            return {
                source: await db.repoPacks.loadImage(pack.id)
            }
        },
        text: cardFormat(event, {
            showAdminInfo: false,
            packs: true
        }),
        buttons
    })
}