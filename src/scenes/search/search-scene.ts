import { BaseScene, Composer, Extra, Markup } from 'telegraf'
import { ContextMessageUpdate, Event } from '../../interfaces/app-interfaces'
import { i18nSceneHelper, isAdmin } from '../../util/scene-helper'
import { getNextWeekendRange, warnAdminIfDateIsOverriden } from '../shared/shared-logic'
import { Paging } from '../shared/paging'
import { SceneRegister } from '../../middleware-utils'
import { db } from '../../database/db'
import { CurrentPage, EventsPager } from '../shared/events-pager'
import emojiRegex from 'emoji-regex'

const scene = new BaseScene<ContextMessageUpdate>('search_scene');

const {sceneHelper, i18nSharedBtnName, actionName, i18Btn, i18Msg, i18SharedMsg, backButton} = i18nSceneHelper(scene)

export interface SearchSceneState {
    request: string
}

async function prepareSessionStateIfNeeded(ctx: ContextMessageUpdate) {
    if (!ctx.scene.current) {
        await ctx.scene.enter('search_scene', undefined, true)
    }
    Paging.prepareSession(ctx)
    if (ctx.session.search === undefined) {
        ctx.session.search = {
            request: undefined
        }
    }
}

const content = (ctx: ContextMessageUpdate) => {

    const {i18SharedBtn, i18Msg} = sceneHelper(ctx)

    return {
        msg: i18Msg('please_search'),
        markupMainMenu: Extra.HTML().markup(Markup.keyboard([Markup.button(i18SharedBtn('back'))]).resize())
    }
}

const eventPager = new EventsPager({
    async nextPortion(ctx: ContextMessageUpdate, {limit, offset}: CurrentPage): Promise<Event[]> {
        const range = getNextWeekendRange(ctx.now())

        const events = await db.repoSearch.search({
            query: ctx.session.search.request,
            limit,
            offset,
            interval: range,
            allowSearchById: isAdmin(ctx)
        })
        return events
    },

    async getTotal(ctx: ContextMessageUpdate): Promise<number> {
        return await db.repoSearch.searchGetTotal({
            query: ctx.session.search.request,
            interval: getNextWeekendRange(ctx.now()),
            allowSearchById: isAdmin(ctx)
        })
    },

    async noResults(ctx: ContextMessageUpdate) {
        await ctx.replyWithHTML(i18Msg(ctx, 'no_results'))
    },

    analytics(ctx: ContextMessageUpdate, events: Event[], {limit, offset}: CurrentPage) {
        const pageNumber = Math.floor(offset / limit) + 1

        const pageTitle = pageNumber > 1 ? ` [Страница ${pageNumber}]` : ''
        const resultsTitle = `${events.length > 0 ? ' есть результаты' : 'ничего не найдено'}`
        ctx.ua.e('Search', 'query', ctx.session.search.request, undefined)
        ctx.ua.pv({
            dp: `/search/${encodeURI(ctx.session.search.request)}/${pageNumber > 1 ? `p${pageNumber}/` : ''}?q=${encodeURIComponent(ctx.session.search.request)}`,
            dt: `Поиск по '${ctx.session.search.request} ${pageTitle}' ${resultsTitle}`
        })
    },
    async onLastEvent(ctx) {
        await ctx.replyWithHTML(i18Msg(ctx, 'last_event'), {
            reply_markup: Markup.inlineKeyboard([[
                Markup.callbackButton(i18Btn(ctx, 'back_to_main'), actionName('back_to_main'))
            ]])
        })
    }
})

scene
    .enter(async (ctx: ContextMessageUpdate) => {
        await prepareSessionStateIfNeeded(ctx)
        EventsPager.reset(ctx)

        const {msg, markupMainMenu} = content(ctx)

        await ctx.replyWithMarkdown(msg, markupMainMenu)
        ctx.ua.pv({dp: `/search/`, dt: `Поиск`})
    })
    .leave(async (ctx: ContextMessageUpdate) => {
        ctx.session.search = undefined
    })
    .use(eventPager.middleware())
    .hears(/^[^/].*$/, async (ctx, next) => {
        if (ctx.match[0].match(emojiRegex())) {
            await next()
            return
        }
        ctx.session.search.request = ctx.match[0]
        await warnAdminIfDateIsOverriden(ctx)
        await eventPager.initialShowCards(ctx)
    })

function postStageActionsFn(bot: Composer<ContextMessageUpdate>) {
    bot
        .action(actionName('back_to_main'), async (ctx) => {
            await ctx.answerCbQuery()
            await ctx.scene.enter('main_scene')
        })
}


export const searchScene = {
    scene,
    postStageActionsFn
} as SceneRegister