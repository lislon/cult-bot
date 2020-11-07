import Telegraf, { BaseScene, Extra, Markup } from 'telegraf'
import { allCategories, ContextMessageUpdate, Event, EventCategory, MyInterval } from '../../interfaces/app-interfaces'
import { i18nSceneHelper, sleep } from '../../util/scene-helper'
import { getTopEvents } from './retrieve-logic'
import { cardFormat } from '../shared/card-format'
import * as events from 'events'
import TelegrafI18n from 'telegraf-i18n'
import { i18n } from '../../util/i18n'
import { Paging } from '../shared/paging'
import { limitEventsToPage, ruFormat, warnAdminIfDateIsOverriden } from '../shared/shared-logic'
import { subSeconds } from 'date-fns/fp'
import { getISODay, isSameMonth, startOfDay } from 'date-fns'

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
        const { msg, markupMainMenu} = content(ctx)
        await prepareSessionStateIfNeeded(ctx)
        Paging.reset(ctx)
        ctx.session.packsScene.isWatchingEvents = false

        await ctx.replyWithMarkdown(msg, markupMainMenu)
        ctx.ua.pv({ dp: '/top/', dt: 'Подборки' })
    })
    .use(Paging.pagingMiddleware(actionName('show_more'),
        async (ctx: ContextMessageUpdate) => {
            Paging.increment(ctx, limitEventsToPage)
            const {events} = await getTopEvents(ctx.session.packsScene.cat, ctx.now(), ctx.session.paging.pagingOffset)
            await showNextPortionOfResults(ctx, events)
            await ctx.editMessageReplyMarkup()
        }))


function intervalTemplateNormalize(range: MyInterval): MyInterval {
    return {
        start: range.start,
        end: startOfDay(range.end).getTime() === range.end.getTime() ? subSeconds(1)(range.end) : range.end
    }
}

function intervalTemplateParams(range: MyInterval) {
    return {
        from: ruFormat(range.start, 'dd.MM HH:mm'),
        to: ruFormat(subSeconds(1)(range.end), 'dd.MM HH:mm')
    }
}

async function showEventsFirstTime(ctx: ContextMessageUpdate) {
    const {range, events} = await getTopEvents(ctx.session.packsScene.cat, ctx.now(), ctx.session.paging.pagingOffset)
    const {i18Btn, i18Msg} = sceneHelper(ctx)

    await warnAdminIfDateIsOverriden(ctx)

    const rangeN = intervalTemplateNormalize(range)

    if (events.length > 0) {
        const tplData = {
            cat: i18Msg(`keyboard.${ctx.session.packsScene.cat}`)
        }

        let humanDateRange = ''
        if (isSameMonth(rangeN.start, range.end)) {
            humanDateRange = ruFormat(rangeN.start, 'dd') + '-' + ruFormat(rangeN.end, 'dd MMMM')
        } else {
            humanDateRange = ruFormat(rangeN.start, 'dd MMMM') + '-' + ruFormat(rangeN.end, 'dd MMMM')
        }

        let templateName

        if (getISODay(ctx.now()) === 6) {
            templateName = 'let_me_show_this_weekend_sat';
        } else if (getISODay(ctx.now()) === 7) {
            templateName = 'let_me_show_this_weekend_sun';
        } else {
            templateName = 'let_me_show_next_weekend';
        }

        await ctx.replyWithHTML(i18Msg(templateName, {humanDateRange, ...tplData}),
            { reply_markup: backMarkup(ctx) })

        await sleep(500)
        await showNextPortionOfResults(ctx, events)
    } else {
        await ctx.reply(i18Msg('nothing_found_in_interval', intervalTemplateParams(range)),
            Extra.HTML(true).markup(backMarkup(ctx))
        )
    }

    ctx.ua.pv({ dp: `/top/${ctx.session.packsScene.cat}`, dt: `Подборки (${ctx.session.packsScene.cat})` })
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