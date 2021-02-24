import { Composer, Markup, Scenes } from 'telegraf'
import { ContextMessageUpdate, EventCategory, MyInterval } from '../../interfaces/app-interfaces'
import { i18nSceneHelper, sleep } from '../../util/scene-helper'
import * as events from 'events'
import { backToMainButtonTitle, ruFormat, warnAdminIfDateIsOverriden } from '../shared/shared-logic'
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


const scene = new Scenes.BaseScene<ContextMessageUpdate>('tops_scene')
const {sceneHelper, actionName, i18nModuleBtnName, i18Btn, i18Msg, i18SharedBtn} = i18nSceneHelper(scene)

const pager = new SliderPager<TopEventsStageQuery>(new TopsPagerConfig())


const backMarkup = (ctx: ContextMessageUpdate) => {
    const btn = Markup.button.text(backToMainButtonTitle())
    return Markup.keyboard([btn]).resize()
}

const content = (ctx: ContextMessageUpdate) => {
    const topLevelMenu = [
        ['theaters', 'exhibitions'],
        ['movies', 'events'],
        ['walks', 'concerts'],
    ]

    const mainButtons = topLevelMenu.map(row =>
        row.map(btnName => {
            return Markup.button.text(i18Btn(ctx, btnName))
        })
    )
    return {
        msg: i18Msg(ctx, 'select_category'),
        markupMainMenu: Markup.keyboard([...mainButtons, [Markup.button.text(backToMainButtonTitle())]]).resize()
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
        ['back_exhibitions'],
    ]

    const buttons = subMenu.map(row =>
        row.map(btnName => {
            return Markup.button.text(i18Btn(ctx, btnName))
        })
    )

    await ctx.replyWithHTML(i18Msg(ctx, 'select_exhibition'),
        Markup.keyboard(buttons).resize()
    )
}

async function showEventsFirstTime(ctx: ContextMessageUpdate) {
    const range = getTopRangeInterval(ctx)
    const total = await getTopEventCount(ctx, ctx.session.topsScene, range)

    await warnAdminIfDateIsOverriden(ctx)

    const rangeHuman = removeLastSecond(range)

    if (total > 0) {
        const tplData = {
            cat: i18Msg(ctx, `keyboard.${ctx.session.topsScene.submenuSelected ? ctx.session.topsScene.submenuSelected : ctx.session.topsScene.cat}`)
        }

        let humanDateRange = ''
        let templateName

        if (isSameDay(ctx.now(), rangeHuman.end)) {
            humanDateRange = ruFormat(rangeHuman.end, 'dd MMMM')
            templateName = 'let_me_show_today'
        } else if (isSameMonth(rangeHuman.start, range.end)) {
            humanDateRange = ruFormat(rangeHuman.start, 'dd') + '-' + ruFormat(rangeHuman.end, 'dd MMMM')
            templateName = 'let_me_show_next_weekend'
        } else {
            humanDateRange = ruFormat(rangeHuman.start, 'dd MMMM') + '-' + ruFormat(rangeHuman.end, 'dd MMMM')
            templateName = 'let_me_show_next_weekend'
        }

        await ctx.replyWithHTML(i18Msg(ctx, templateName, {humanDateRange, ...tplData}), backMarkup(ctx))

        await sleep(70)
        const sliderState = await pager.updateState(ctx, {
            state: ctx.session.topsScene,
            total
        })
        await pager.showOrUpdateSlider(ctx, sliderState, {
            forceNewMsg: true
        })
    } else {
        await ctx.replyWithHTML(i18Msg(ctx, 'nothing_found_in_interval', intervalTemplateParams(range)), backMarkup(ctx))
    }
}

function trackUa(ctx: ContextMessageUpdate) {
    ctx.ua.pv(analyticsTopParams(ctx.session.topsScene))
}

scene
    .enter(async ctx => {
        const {msg, markupMainMenu} = content(ctx)
        await prepareSessionStateIfNeeded(ctx)

        ctx.session.topsScene.isWatchingEvents = false
        ctx.session.topsScene.isInSubMenu = false

        await ctx.replyWithHTML(msg, markupMainMenu)
        ctx.ua.pv({dp: '/top/', dt: 'Рубрики'})
    })
    .leave(async (ctx) => {
        ctx.session.topsScene = undefined
    })
    .hears(i18nModuleBtnName('back_exhibitions'), async ctx => {
        await ctx.scene.enter('tops_scene')
    })

function postStageActionsFn(bot: Composer<ContextMessageUpdate>) {

    for (const cat of ['theaters', 'movies', 'events', 'walks', 'concerts', 'exhibitions_temp', 'exhibitions_perm']) {
        bot.hears(i18nModuleBtnName(cat), async ctx => {
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
            await showEventsFirstTime(ctx)
        })
    }
    bot
        .hears(i18nModuleBtnName('exhibitions'), async ctx => {
            await prepareSessionStateIfNeeded(ctx)
            ctx.session.topsScene.isInSubMenu = true
            ctx.session.topsScene.cat = 'exhibitions'
            await showExhibitionsSubMenu(ctx)
            trackUa(ctx)
        })
        .action(actionName('back_inline'), async ctx => {
            await prepareSessionStateIfNeeded(ctx)
            await ctx.answerCbQuery()
            if (ctx.session.topsScene.submenuSelected !== undefined) {
                ctx.session.topsScene.submenuSelected = undefined
                await showExhibitionsSubMenu(ctx)
            } else if (ctx.session.topsScene.isWatchingEvents) {
                await ctx.scene.enter('tops_scene')
            } else {
                await ctx.scene.enter('main_scene')
            }
        })
        .use(pager.middleware())
}

export const topsScene : SceneRegister = {
    scene,
    postStageActionsFn
}