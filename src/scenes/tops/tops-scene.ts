import { BaseScene, Composer, Extra, Markup } from 'telegraf'
import { ContextMessageUpdate, EventCategory, MyInterval } from '../../interfaces/app-interfaces'
import { i18nSceneHelper, sleep } from '../../util/scene-helper'
import * as events from 'events'
import { i18n } from '../../util/i18n'
import { replyDecoyNoButtons, ruFormat, warnAdminIfDateIsOverriden } from '../shared/shared-logic'
import { subSeconds } from 'date-fns/fp'
import { isSameDay, isSameMonth, startOfDay } from 'date-fns'
import { SceneRegister } from '../../middleware-utils'
import { SliderPager } from '../shared/slider-pager'
import { TopsPagerConfig } from './tops-pager-config'
import {
    analyticsTopParams,
    getTopEventCount,
    getTopRangeInterval,
    prepareSessionStateIfNeeded,
    TopEventsStageQuery
} from './tops-common'


const scene = new BaseScene<ContextMessageUpdate>('tops_scene')
const {sceneHelper, actionName, i18nModuleBtnName, i18Btn, i18Msg, i18SharedBtn} = i18nSceneHelper(scene)

const pager = new SliderPager<TopEventsStageQuery>(new TopsPagerConfig())


const backMarkup = (ctx: ContextMessageUpdate) => {
    const {i18SharedBtn} = sceneHelper(ctx)

    const btn = Markup.button(i18SharedBtn('back'))

    return Markup.keyboard([btn]).resize()
}

const content = (ctx: ContextMessageUpdate) => {
    const topLevelMenu = [
        ['theaters', 'exhibitions'],
        ['movies', 'events'],
        ['walks', 'concerts'],
        ['back'],
    ]

    const mainButtons = topLevelMenu.map(row =>
        row.map(btnName => {
            return Markup.button(i18Btn(ctx, btnName))
        })
    )
    return {
        msg: i18Msg(ctx, 'select_category'),
        markupMainMenu: Extra.HTML(true).markup(Markup.keyboard(mainButtons).resize())
    }
}


function removeLastSecond(range: MyInterval): MyInterval {
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

async function showExhibitionsSubMenu(ctx: ContextMessageUpdate) {
    const subMenu = [
        ['exhibitions_perm'],
        ['exhibitions_temp'],
        ['back'],
    ]

    const buttons = subMenu.map(row =>
        row.map(btnName => {
            return Markup.button(i18Btn(ctx, btnName))
        })
    )

    await ctx.reply(i18Msg(ctx, 'select_exhibition'),
        Extra.HTML().markup(Markup.keyboard(buttons).resize())
    )
}

async function showEventsFirstTime(ctx: ContextMessageUpdate) {
    const range = getTopRangeInterval(ctx)
    const total = await getTopEventCount(ctx, ctx.session.topsScene, range)

    await warnAdminIfDateIsOverriden(ctx)

    const rangeN = removeLastSecond(range)

    if (total > 0) {
        const tplData = {
            cat: i18Msg(ctx, `keyboard.${ctx.session.topsScene.submenuSelected ? ctx.session.topsScene.submenuSelected : ctx.session.topsScene.cat}`)
        }

        let humanDateRange = ''
        if (isSameMonth(rangeN.start, range.end)) {
            humanDateRange = ruFormat(rangeN.start, 'dd') + '-' + ruFormat(rangeN.end, 'dd MMMM')
        } else {
            humanDateRange = ruFormat(rangeN.start, 'dd MMMM') + '-' + ruFormat(rangeN.end, 'dd MMMM')
        }

        let templateName

        if (isSameDay(ctx.now(), rangeN.end)) {
            templateName = 'let_me_show_today'
        } else {
            templateName = 'let_me_show_next_weekend'
        }

        await ctx.replyWithHTML(i18Msg(ctx, templateName, {humanDateRange, ...tplData}),
            Extra.markup(Markup.removeKeyboard()))

        await sleep(70)
        const sliderState = await pager.updateState(ctx, ctx.session.topsScene, total, undefined)
        await pager.showOrUpdateSlider(ctx, sliderState)
    } else {
        await ctx.reply(i18Msg(ctx, 'nothing_found_in_interval', intervalTemplateParams(range)),
            Extra.HTML(true).markup(backMarkup(ctx))
        )
    }
}

function trackUa(ctx: ContextMessageUpdate) {
    ctx.ua.pv(analyticsTopParams(ctx.session.topsScene))
}

async function goBack(ctx: ContextMessageUpdate) {
    await prepareSessionStateIfNeeded(ctx)
    if (ctx.session.topsScene.submenuSelected !== undefined) {
        ctx.session.topsScene.submenuSelected = undefined
        await showExhibitionsSubMenu(ctx)
    } else if (ctx.session.topsScene.isWatchingEvents) {
        await ctx.scene.enter('tops_scene')
    } else {
        await ctx.scene.enter('main_scene')
    }
}

scene
    .enter(async (ctx: ContextMessageUpdate) => {
        const {msg, markupMainMenu} = content(ctx)
        await prepareSessionStateIfNeeded(ctx)

        ctx.session.topsScene.isWatchingEvents = false
        ctx.session.topsScene.isInSubMenu = false

        await ctx.replyWithMarkdown(msg, markupMainMenu)
        ctx.ua.pv({dp: '/top/', dt: 'Рубрики'})
    })
    .leave(async (ctx) => {
        ctx.session.topsScene = undefined
    })
    .hears(i18n.t(`ru`, `shared.keyboard.back`), async (ctx: ContextMessageUpdate) => {
        await goBack(ctx)
    })

function postStageActionsFn(bot: Composer<ContextMessageUpdate>) {

    for (const cat of ['theaters', 'movies', 'events', 'walks', 'concerts', 'exhibitions_temp', 'exhibitions_perm']) {
        bot.hears(i18nModuleBtnName(cat), async (ctx: ContextMessageUpdate) => {
            await prepareSessionStateIfNeeded(ctx)
            if (cat === 'exhibitions_temp' || cat === 'exhibitions_perm') {
                ctx.session.topsScene.cat = 'exhibitions'
                ctx.session.topsScene.submenuSelected = cat
            } else {
                ctx.session.topsScene.cat = cat as EventCategory
                ctx.session.topsScene.submenuSelected = undefined
            }
            ctx.session.topsScene.isWatchingEvents = true
            ctx.session.topsScene.isInSubMenu = false
            await replyDecoyNoButtons(ctx)
            await showEventsFirstTime(ctx)
            trackUa(ctx)
        })
    }
    bot
        .hears(i18nModuleBtnName('exhibitions'), async (ctx: ContextMessageUpdate) => {
            await prepareSessionStateIfNeeded(ctx)
            ctx.session.topsScene.isInSubMenu = true
            ctx.session.topsScene.cat = 'exhibitions'
            await showExhibitionsSubMenu(ctx)
            trackUa(ctx)
        })
        .action(actionName('back_inline'), async ctx => {
            await ctx.answerCbQuery()
            await goBack(ctx)
        })
        .use(pager.middleware())
}

export const topsScene = {
    scene,
    postStageActionsFn
} as SceneRegister