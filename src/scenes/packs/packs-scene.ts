import Telegraf, { BaseScene, Extra, Markup } from 'telegraf'
import { allCategories, ContextMessageUpdate, Event, EventCategory } from '../../interfaces/app-interfaces'
import { i18nSceneHelper, sleep } from '../../util/scene-helper'
import { getTopEvents } from './retrieve-logic'
import { cardFormat } from '../shared/card-format'
import * as events from 'events'
import { filterByByRange } from '../../lib/timetable/intervals'
import { mskMoment } from '../../util/moment-msk'
import { Moment } from 'moment'
import TelegrafI18n from 'telegraf-i18n'
import { i18n } from '../../util/i18n'
import { Paging } from '../shared/paging'
import { limitEventsToPage } from '../shared/shared-logic'

export interface PacksSceneState {
    isWatchingEvents: boolean,
    cat: EventCategory
}

const scene = new BaseScene<ContextMessageUpdate>('packs_scene');

const { sceneHelper, actionName, i18nModuleBtnName} = i18nSceneHelper(scene)

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
        ['back'],
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
        await ctx.scene.enter('packs_scene', undefined, true)
    }
    Paging.prepareSession(ctx)
    if (ctx.session.packsScene === undefined) {
        ctx.session.packsScene = {
            isWatchingEvents: false,
            cat: undefined
        }
    }
}

scene
    .enter(async (ctx: ContextMessageUpdate) => {
        console.log('enter scene pack_scene')
        const { msg, markupMainMenu} = content(ctx)
        await prepareSessionStateIfNeeded(ctx)
        Paging.reset(ctx)
        ctx.session.packsScene.isWatchingEvents = false

        await ctx.replyWithMarkdown(msg, markupMainMenu)
    })
    .leave(async (ctx: ContextMessageUpdate) => {
        console.log('exit scene pack_scene')
    })
    .use(Paging.pagingMiddleware(actionName('show_more'),
        async (ctx: ContextMessageUpdate) => {
            Paging.increment(ctx, limitEventsToPage)
            const {events} = await getTopEvents(ctx.session.packsScene.cat, ctx.session.paging.pagingOffset)
            await showNextPortionOfResults(ctx, events)
            await ctx.editMessageReplyMarkup()
        }))


function isWeekendsNow(range: [Moment, Moment]) {
    return filterByByRange([mskMoment()], range, 'in').length > 0
}

function intervalTemplateNormalize(range: [Moment, Moment]): [Moment, Moment] {
    return [
        range[0],
        range[1].isSame(range[1].clone().startOf('day')) ? range[1].clone().subtract(1, 'second') : range[1]
    ]
}

function intervalTemplateParams(range: [Moment, Moment]) {
    return {
        from: range[0].locale('ru').format('DD.MM HH:mm'),
        to: range[1].locale('ru').subtract('1', 'second').format('DD.MM HH:mm')
    }
}

async function showEventsFirstTime(ctx: ContextMessageUpdate) {
    const {range, events} = await getTopEvents(ctx.session.packsScene.cat, ctx.session.paging.pagingOffset)
    const {i18Btn, i18Msg} = sceneHelper(ctx)

    const rangeN = intervalTemplateNormalize(range)

    if (events.length > 0) {
        const tplData = {
            cat: i18Msg(`keyboard.${ctx.session.packsScene.cat}`)
        }
        if (isWeekendsNow(rangeN)) {
            await ctx.replyWithHTML(i18Msg('let_me_show_this_weekend', tplData), {
                reply_markup: backMarkup(ctx)
            })
        } else {
            let humanDateRange = ''
            if (rangeN[0].month() === rangeN[1].month()) {
                humanDateRange = rangeN[0].locale('ru').format('DD') + '-' + rangeN[1].locale('ru').format('DD MMMM')
            } else {
                humanDateRange = rangeN[0].locale('ru').format('DD MMMM') + '-' + rangeN[1].locale('ru').format('DD MMMM')
            }

            await ctx.replyWithHTML(i18Msg('let_me_show_next_weekend', {humanDateRange, ...tplData}), { reply_markup: backMarkup(ctx) })
        }

        await sleep(500)
        await showNextPortionOfResults(ctx, events)
    } else {
        await ctx.reply(i18Msg('nothing_found_in_interval', intervalTemplateParams(range)),
            Extra.HTML(true).markup(backMarkup(ctx))
        )
    }
}
async function showNextPortionOfResults(ctx: ContextMessageUpdate, events: Event[]) {
    const {i18Btn, i18Msg} = sceneHelper(ctx)

    const nextBtn = Markup.inlineKeyboard([
        Markup.callbackButton(i18Btn('show_more'), actionName('show_more'))
    ])

    const fireRating = 18
    const sortedByRating = events.filter(e => e.rating >= fireRating).sort(e => e.rating)

    let count = 0
    for (const event of events) {

        await ctx.replyWithHTML(cardFormat(event), {
            disable_web_page_preview: true,
            reply_markup: (++count === events.length ? nextBtn : undefined)
        })


        if (sortedByRating.length > 0 && sortedByRating[0] === event) {
            await ctx.replyWithHTML(i18Msg('its_fire'));
        }

        await sleep(300)
    }

    if (events.length === 0) {
        await ctx.reply(i18Msg('no_more_events'))
    }

    console.log(`${events.length} events returned for cat=${ctx.session.packsScene.cat}. offset=${ctx.session.paging.pagingOffset}`)
}

scene.hears(i18n.t(`ru`, `shared.keyboard.back`), async (ctx: ContextMessageUpdate) => {
    console.log('pack-scene-back')
    await prepareSessionStateIfNeeded(ctx)
    if (ctx.session.packsScene.isWatchingEvents) {
        await ctx.scene.enter('packs_scene')
    } else {
        await ctx.scene.enter('main_scene')
    }
});

function registerActions(bot: Telegraf<ContextMessageUpdate>, i18n: TelegrafI18n) {
    for (const cat of allCategories) {
        bot.hears(i18nModuleBtnName(cat), async (ctx: ContextMessageUpdate) => {
            await prepareSessionStateIfNeeded(ctx)
            ctx.session.packsScene.cat = cat as EventCategory;
            ctx.session.packsScene.isWatchingEvents = true
            await showEventsFirstTime(ctx)
        });
    }
}

export {
    scene as packsScene,
    registerActions as packsRegisterActions
}