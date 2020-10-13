import Telegraf, { BaseScene, Extra, Markup } from 'telegraf'
import { ContextMessageUpdate, EventCategory } from '../../interfaces/app-interfaces'
import { i18nSceneHelper, isAdmin, sleep } from '../../util/scene-helper'
import TelegrafI18n from 'telegraf-i18n'
import { cardFormat } from '../shared/card-format'
import { mskMoment } from '../../util/moment-msk'
import { limitEventsToPage, ruFormat, showBotVersion, syncrhonizeDbByUser } from '../shared/shared-logic'
import { db } from '../../db'
import { Paging } from '../shared/paging'
import { isValid, parse } from 'date-fns'

const scene = new BaseScene<ContextMessageUpdate>('admin_scene');

export interface AdminSceneState {
    cat: EventCategory,
    overrideDate?: string
}

const { sceneHelper, actionName, i18nModuleBtnName} = i18nSceneHelper(scene)

const globalInterval = { start: new Date(2000, 1, 1), end: new Date(3000, 1, 1) }

const menu = [
    ['theaters', 'exhibitions'],
    ['movies', 'events'],
    ['walks', 'concerts']
]

const content = async (ctx: ContextMessageUpdate) => {
    const {i18Btn, i18Msg, i18SharedBtn} = sceneHelper(ctx)

    const stats = await db.repoAdmin.findStats(globalInterval)

    const mainButtons = menu.map(row =>
        row.map(btnName => {
            const count = stats.find(r => r.category === btnName)
            return Markup.callbackButton(i18Btn(btnName, { count: count === undefined ? 0 : count.count }), actionName(btnName));
        })
    );
    mainButtons.push([
        Markup.callbackButton(i18Btn('sync'), actionName('sync')),
        Markup.callbackButton(i18Btn('version'), actionName('version')),
    ])
    mainButtons.push([Markup.callbackButton(i18SharedBtn('back'), actionName('back'))])

    return {
        msg: i18Msg('welcome'),
        markup: Extra.HTML().markup(Markup.inlineKeyboard(mainButtons))
    }
}

const limitInAdmin = 10

scene
    .enter(async (ctx: ContextMessageUpdate) => {
        prepareSessionStateIfNeeded(ctx)
        const {msg, markup} = await content(ctx)
        await ctx.replyWithMarkdown(msg, markup)
    })
    .use(Paging.pagingMiddleware(actionName('show_more'),
        async (ctx: ContextMessageUpdate) => {
            Paging.increment(ctx, limitInAdmin)
            await showNextResults(ctx)
            await ctx.answerCbQuery()
        }))
    .action(actionName('sync'), async (ctx: ContextMessageUpdate) => {
        await ctx.answerCbQuery()
        await syncrhonizeDbByUser(ctx)
    })
    .action(actionName('version'), async (ctx: ContextMessageUpdate) => {
        await ctx.answerCbQuery()
        await showBotVersion(ctx)
    })

async function showNextResults(ctx: ContextMessageUpdate) {
    const stats = await db.repoAdmin.findStats(globalInterval)
    const total = stats.find(r => r.category === ctx.session.adminScene.cat).count

    const {i18Btn, i18Msg} = sceneHelper(ctx)

    const events = await db.repoAdmin.findAllEventsAdmin(ctx.session.adminScene.cat, globalInterval, limitInAdmin, ctx.session.paging.pagingOffset)

    const nextBtn = Markup.inlineKeyboard([
        Markup.callbackButton(i18Btn('show_more', {
            page: Math.ceil(ctx.session.paging.pagingOffset / limitInAdmin) + 1,
            total: Math.ceil(+total / limitInAdmin)
        }), actionName('show_more'))
    ])

    let count = 0
    for (const event of events) {
        await ctx.replyWithHTML(cardFormat(event), {
            disable_web_page_preview: true,
            reply_markup: (++count == events.length && events.length === limitInAdmin ? nextBtn : undefined)
        })
        await sleep(200)
    }
}

menu.flatMap(m => m).forEach(menuItem => {
    scene.action(actionName(menuItem), async (ctx: ContextMessageUpdate) => {
        await ctx.answerCbQuery()
        await prepareSessionStateIfNeeded(ctx)
        ctx.session.adminScene.cat = menuItem as EventCategory
        Paging.reset(ctx)
        await showNextResults(ctx)
    })
})


async function prepareSessionStateIfNeeded(ctx: ContextMessageUpdate) {
    if (!ctx.scene.current) {
        await ctx.scene.enter('admin_scene', undefined, true)
    }
    Paging.prepareSession(ctx)
    if (ctx.session.adminScene === undefined) {
        ctx.session.adminScene = {
            cat: undefined,
            overrideDate: undefined
        }
    }
}

function registerActions(bot: Telegraf<ContextMessageUpdate>, i18n: TelegrafI18n) {
    bot.command('admin', (async (ctx: ContextMessageUpdate) => {
        await ctx.scene.enter('admin_scene');
    }))

    bot.command('time', (async (ctx: ContextMessageUpdate) => {
        if (isAdmin(ctx)) {
            await prepareSessionStateIfNeeded(ctx)
            const dateStr = ctx.message.text.replace(/^\/time[\s]*/, '')
            if (dateStr === undefined || dateStr === 'now') {
                ctx.session.adminScene.overrideDate = undefined
                await ctx.replyWithHTML('Переопределние даты сброшено')
            } else if (dateStr === '') {
                await ctx.replyWithHTML(`Текущее время: ${ctx.session.adminScene.overrideDate}`)
            } else {
                const parsed = parse(dateStr, 'yyyy-MM-dd HH:mm', new Date())
                if (isValid(parsed)) {
                    ctx.session.adminScene.overrideDate = parsed.toISOString()
                    await ctx.replyWithHTML('Притворяемся, что сейчас: ' + parsed.toString() + ' Чтобы сбросить выполните /time now')
                } else {
                    await ctx.replyWithHTML('Сорян, Не поняла команду. Пример: /time 2021-05-12 12:00')
                }
            }
        }
    }))
}

export {
    scene as adminScene,
    registerActions as adminRegisterActions
}