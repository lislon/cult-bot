import Telegraf, { BaseScene, Extra, Markup } from 'telegraf'
import { ContextMessageUpdate } from '../../interfaces/app-interfaces'
import { i18nSceneHelper, sleep } from '../../util/scene-helper'
import TelegrafI18n from 'telegraf-i18n'
import { db } from '../../db'
import { getNextWeekEndRange, limitEventsToPage, warnAdminIfDateIsOverriden } from '../shared/shared-logic'
import { cardFormat } from '../shared/card-format'
import { Paging } from '../shared/paging'

const scene = new BaseScene<ContextMessageUpdate>('search_scene');

const {sceneHelper, i18nSharedBtnName, actionName} = i18nSceneHelper(scene)

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
        markupMainMenu: Extra.HTML(true).markup(Markup.keyboard([Markup.button(i18SharedBtn('back'))]).resize())
    }
}

async function showSearchResults(ctx: ContextMessageUpdate) {
    const range = getNextWeekEndRange(ctx.now())

    const events = await db.repoSearch.search({
        query: ctx.session.search.request,
        limit: limitEventsToPage,
        offset: ctx.session.paging.pagingOffset,
        interval: range
    })

    console.log(`Search: '${ctx.session.search.request}' offset=${ctx.session.paging.pagingOffset} found=${events.length}`)
    const {i18Btn, i18Msg} = sceneHelper(ctx)

    const nextBtn = Markup.inlineKeyboard([
        Markup.callbackButton(i18Btn('show_more'), actionName('show_more'))
    ])

    let count = 0;
    for (const event of events) {

        await ctx.replyWithHTML(cardFormat(event), {
            disable_web_page_preview: true,
            reply_markup: (++count === events.length && events.length === limitEventsToPage ? nextBtn : undefined)
        })

        await sleep(300)
    }

    if (events.length === 0) {
        if (ctx.session.paging.pagingOffset > 0) {
            await ctx.reply(i18Msg('no_more_events'))
        } else {
            await ctx.reply(i18Msg('no_results'))
        }
    }
    ctx.ua.pv({
        dp: `/search/${ctx.session.search.request}/`,
        dt: `Поиск по '${ctx.session.search.request}' ${events.length > 0 ? ' есть результаты' : 'ничего не найдено'}`
    })
}

scene
    .enter(async (ctx: ContextMessageUpdate) => {
        console.log('enter scene search_scene')

        await prepareSessionStateIfNeeded(ctx)
        Paging.reset(ctx)

        const {msg, markupMainMenu} = content(ctx)

        await ctx.replyWithMarkdown(msg, markupMainMenu)
        ctx.ua.pv({dp: `/search/`, dt: `Поиск`})
    })
    .leave(async (ctx: ContextMessageUpdate) => {
        console.log('exit scene search_scene')
    })
    .use(Paging.pagingMiddleware(actionName('show_more'),
        async (ctx: ContextMessageUpdate) => {
            Paging.increment(ctx, limitEventsToPage)
            await showSearchResults(ctx)
            await ctx.editMessageReplyMarkup()
        }))
    .hears(i18nSharedBtnName('back'), async (ctx: ContextMessageUpdate) => {
        await ctx.scene.enter('main_scene')
    })
    .hears(/.+/, async (ctx: ContextMessageUpdate) => {
        Paging.reset(ctx)
        ctx.session.search.request = ctx.match[0]
        await warnAdminIfDateIsOverriden(ctx)
        await showSearchResults(ctx)
    })

function registerActions(bot: Telegraf<ContextMessageUpdate>, i18n: TelegrafI18n) {
    // bot
    //     .hears(i18nModuleBtnName('packs'), async (ctx: ContextMessageUpdate) => {
    //         await ctx.scene.enter('packs_scene')
    //     })
    //     .hears(i18nModuleBtnName('search'), async (ctx: ContextMessageUpdate) => {
    //         await ctx.scene.enter('search_scene')
    //     })
    //     .hears(i18nModuleBtnName('customize'), async (ctx: ContextMessageUpdate) => {
    //         await ctx.scene.enter('customize_scene')
    //     })
    //     .hears(i18nModuleBtnName('admin'), async (ctx: ContextMessageUpdate) => {
    //         await ifAdmin(ctx, () => ctx.scene.enter('admin_scene'))
    //     });
}

export {
    scene as searchScene,
    registerActions as searchRegisterActions
}