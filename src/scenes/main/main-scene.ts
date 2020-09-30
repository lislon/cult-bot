import Telegraf, { BaseScene, Extra, Markup } from 'telegraf'
import { allCategories, ContextMessageUpdate, EventCategory } from '../../interfaces/app-interfaces'
import { i18nSceneHelper, ifAdmin, isAdmin, sleep } from '../../util/scene-helper'
import { getTopEvents } from './retrieve-logic'
import { cardFormat } from '../shared/card-format'
import * as events from 'events'
import { filterByByRange } from '../../lib/timetable/intervals'
import { mskMoment } from '../../util/moment-msk'
import { Moment } from 'moment'
import TelegrafI18n from 'telegraf-i18n'
import { i18n } from '../../util/i18n'

export interface MainSceneState {
    gcMessages: number[]
    messageId: number
}


const scene = new BaseScene<ContextMessageUpdate>('main_scene');

const {backButton, sceneHelper, actionName} = i18nSceneHelper(scene)

const backMarkup = (ctx: ContextMessageUpdate) => {
    const {i18SharedBtn} = sceneHelper(ctx)

    const btn = Markup.button(i18SharedBtn('back'))
    // return Extra.HTML(true).markup(Markup.keyboard([btn]).resize().oneTime())
    return Markup.keyboard([btn]).resize()
}

const content = (ctx: ContextMessageUpdate) => {

    const {i18Btn, i18Msg} = sceneHelper(ctx)

    const menu = [
        ['theaters', 'exhibitions'],
        ['movies', 'events'],
        ['walks', 'concerts'],
        ['customize', ...(isAdmin(ctx) ? ['admin'] : [])]
    ]

    const mainButtons = menu.map(row =>
        row.map(btnName => {
            return Markup.button(i18Btn(btnName));
        })
    );
    return {
        msg: i18Msg('select_category'),
        markupMainMenu: Extra.HTML(true).markup(Markup.keyboard(mainButtons).resize())
    }
}

async function prepareSessionStateIfNeeded(ctx: ContextMessageUpdate) {
    if (!ctx.scene.current) {
        await ctx.scene.enter('main_scene', undefined, true)
    }
    if (ctx.session.mainScene === undefined) {
        console.log(`context doesn't exist. recreate`)
        ctx.session.mainScene = {
            gcMessages: [],
            messageId: undefined
        }
    }
}
//
// scene.hears('g', async (ctx: ContextMessageUpdate) => {
//     await prepareSessionStateIfNeeded(ctx)
//     ctx.session.mainScene.gcMessages.push(ctx.session.mainScene.gcMessages.length)
//     await ctx.replyWithMarkdown('x ' + ctx.session.mainScene.gcMessages)
// })

scene.enter(async (ctx: ContextMessageUpdate) => {
    console.log('enter scene main_scene')
    const { msg, markupMainMenu} = content(ctx)

    await prepareSessionStateIfNeeded(ctx)

    ctx.session.mainScene.messageId = (await ctx.replyWithMarkdown(msg, markupMainMenu)).message_id
})

scene.leave(async (ctx: ContextMessageUpdate) => {
    console.log('exit scene main_scene')
 })

async function cleanOldMessages(ctx: ContextMessageUpdate) {
    // console.log(`old messages clean (${ctx.session.mainScene.gcMessages.length})`)
    // for (const messageId of ctx.session.mainScene.gcMessages) {
    //     await ctx.deleteMessage(messageId)
    // }
    // ctx.session.mainScene.gcMessages.length = 0
    // if (ctx.session.mainScene.messageId !== undefined) {
    //     await ctx.deleteMessage(ctx.session.mainScene.messageId)
    //     ctx.session.mainScene.messageId = undefined
    // }
}

function isWeekendsNow(range: [Moment, Moment]) {
    return filterByByRange([mskMoment()], range, 'in').length > 0
}

function intervalTemplateParams(range: [Moment, Moment]) {
    return {
        from: range[0].locale('ru').format('DD.MM HH:mm'),
        to: range[1].locale('ru').subtract('1', 'second').format('DD.MM HH:mm')
    }
}

async function showEvents(ctx: ContextMessageUpdate, cat: EventCategory) {
    const {i18Btn, i18Msg} = sceneHelper(ctx)
    const {range, events} = await getTopEvents(cat)
    // const gcMessages = ctx.session.mainScene.gcMessages
    const { msg, markupMainMenu} = content(ctx)

    // await cleanOldMessages(ctx)
    await sleep(400)
    if (events.length > 0) {
        const tplData = {
            cat: i18Msg(`keyboard.${cat}`)
        }
        if (isWeekendsNow(range)) {
            await ctx.replyWithHTML(i18Msg('let_me_show_this_weekend', tplData), {
                reply_markup: markupMainMenu.reply_markup
            })
        } else {
            let humanDateRange = ''
            if (range[0].month() === range[1].month()) {
                humanDateRange = range[0].locale('ru').format('D') + '-' + range[1].locale('ru').format('D MMMM')
            } else {
                humanDateRange = range[0].locale('ru').format('D MMMM') + '-' + range[1].locale('ru').format('D MMMM')
            }

            await ctx.replyWithHTML(i18Msg('let_me_show_next_weekend', {humanDateRange, ...tplData}))
        }

        await sleep(1300)
    }

    const sortedByRating = events.filter(e => e.rating >= 17).sort(e => e.rating)
    let count = 0
    for (const event of events) {

        const {range, events} = await getTopEvents(cat)

        await ctx.replyWithHTML(cardFormat(event), {
            disable_web_page_preview: true,
            reply_markup: (++count == events.length ? backMarkup(ctx) : undefined)
        })

        if (sortedByRating.length > 0 && sortedByRating[0] === event) {
            await sleep(300)
            await ctx.replyWithHTML(i18Msg('its_fire'));
        }

        await sleep(1000)
    }

    if (events.length == 0) {
        await ctx.reply(i18Msg('nothing_found_in_interval', intervalTemplateParams(range)),
            Extra.HTML(true).markup(backMarkup(ctx))
        )
    }
    console.log(`${events.length} events returned for cat=${cat}`)
}

scene.hears(i18n.t(`ru`, `shared.keyboard.back`), async (ctx: ContextMessageUpdate) => {
    console.log('main-scene-back')
    const { msg, markupMainMenu} = content(ctx)
    // await sleep(2000)
    // ctx.replyWithMarkdown('BIG', markupMainMenu)
    // await sleep(2000)
    await cleanOldMessages(ctx)
    await ctx.scene.enter('main_scene')
});

function registerActions(bot: Telegraf<ContextMessageUpdate>, i18n: TelegrafI18n) {
    for (const cat of allCategories) {

        bot.hears(i18n.t(`ru`, `scenes.main_scene.keyboard.${cat}`), async (ctx: ContextMessageUpdate) => {
            await prepareSessionStateIfNeeded(ctx)
            ctx.session.mainScene.gcMessages.push(ctx.message.message_id)
            await showEvents(ctx, cat as EventCategory)
        });


        bot.hears(i18n.t(`ru`, `scenes.main_scene.keyboard.customize`), async (ctx: ContextMessageUpdate) => {
            await ctx.scene.enter('customize_scene')
        });
        bot.hears(i18n.t(`ru`, `scenes.main_scene.keyboard.admin`), async (ctx: ContextMessageUpdate) => {
            await ifAdmin(ctx, () => ctx.scene.enter('admin_scene'))
        });
    }
}

export {
    scene as mainScene,
    registerActions as mainRegisterActions
}