import { Composer, Markup, Scenes } from 'telegraf'
import { ContextMessageUpdate, DateInterval } from '../../interfaces/app-interfaces'
import { EventCategory } from '@culthub/interfaces'
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
    TopEventsStageQuery, TopsSceneState
} from './tops-common'
import { sleep } from '../../util/scene-utils'
import { i18nSceneHelper } from '../../util/scene-helper'


const scene = new Scenes.BaseScene<ContextMessageUpdate>('tops_scene')
const {actionName, i18nModuleBtnName, i18Btn, i18Msg} = i18nSceneHelper(scene)

const pager = new SliderPager<TopEventsStageQuery>(new TopsPagerConfig())


const backMarkup = () => {
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


function removeLastSecond(range: DateInterval): DateInterval {
    return {
        start: range.start,
        end: startOfDay(range.end).getTime() === range.end.getTime() ? subSeconds(1)(range.end) : range.end
    }
}

function intervalTemplateParams(range: DateInterval) {
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

async function showEventsFirstTime(ctx: ContextMessageUpdate, query: TopEventsStageQuery) {
    const range = getTopRangeInterval(ctx)
    const total = await getTopEventCount(ctx, query, range)

    await warnAdminIfDateIsOverriden(ctx)

    const rangeHuman = removeLastSecond(range)

    if (total > 0) {
        const tplData = {
            cat: i18Msg(ctx, `keyboard.${query.submenuSelected ? query.submenuSelected : query.cat}`)
        }

        let humanDateRange: string
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

        await ctx.replyWithHTML(i18Msg(ctx, templateName, {humanDateRange, ...tplData}), backMarkup())

        await sleep(70)
        const sliderState = await pager.updateState(ctx, {
            state: query,
            total
        })
        await pager.showOrUpdateSlider(ctx, sliderState, {
            forceNewMsg: true
        })
    } else {
        await ctx.replyWithHTML(i18Msg(ctx, 'nothing_found_in_interval', intervalTemplateParams(range)), backMarkup())
    }
}

function trackUa(ctx: ContextMessageUpdate, topSceneState: TopsSceneState): void {
    if (topSceneState.cat !== undefined) {
        ctx.ua.pv(analyticsTopParams({
            cat: topSceneState.cat,
            submenuSelected: topSceneState.submenuSelected
        }))
    }
}

scene
    .enter(async ctx => {
        const {msg, markupMainMenu} = content(ctx)
        const topSceneState = await prepareSessionStateIfNeeded(ctx)

        topSceneState.isWatchingEvents = false
        topSceneState.isInSubMenu = false

        await ctx.replyWithHTML(msg, markupMainMenu)
        ctx.ua.pv({dp: '/top/', dt: 'Рубрики'})
    })
    .leave(async (ctx) => {
        ctx.session.topsScene = undefined
    })
    .hears(i18nModuleBtnName('back_exhibitions'), async ctx => {
        await ctx.scene.enter('tops_scene')
    })

function postStageActionsFn(bot: Composer<ContextMessageUpdate>): void {

    for (const cat of ['theaters', 'movies', 'events', 'walks', 'concerts', 'exhibitions_temp', 'exhibitions_perm']) {
        bot.hears(i18nModuleBtnName(cat), async ctx => {
            const topSceneState = await prepareSessionStateIfNeeded(ctx)
            topSceneState.isWatchingEvents = true
            topSceneState.isInSubMenu = false

            const isExhibition = cat === 'exhibitions_temp' || cat === 'exhibitions_perm'
            await showEventsFirstTime(ctx, {
                cat: isExhibition ? 'exhibitions' : cat as EventCategory,
                submenuSelected: isExhibition ? (cat === 'exhibitions_temp' ? 'exhibitions_temp' : 'exhibitions_perm') : undefined
            })
        })
    }
    bot
        .hears(i18nModuleBtnName('exhibitions'), async ctx => {
            const topSceneState = await prepareSessionStateIfNeeded(ctx)
            topSceneState.isInSubMenu = true
            topSceneState.cat = 'exhibitions'
            await showExhibitionsSubMenu(ctx)
            trackUa(ctx, topSceneState)
        })
        .action(actionName('back_inline'), async ctx => {
            const topSceneState = await prepareSessionStateIfNeeded(ctx)
            await ctx.answerCbQuery()
            if (topSceneState.submenuSelected !== undefined) {
                topSceneState.submenuSelected = undefined
                await showExhibitionsSubMenu(ctx)
            } else if (topSceneState.isWatchingEvents) {
                await ctx.scene.enter('tops_scene')
            } else {
                await ctx.scene.enter('main_scene')
            }
        })
        .use(pager.middleware())
}

export const topsScene: SceneRegister = {
    scene,
    postStageActionsFn
}