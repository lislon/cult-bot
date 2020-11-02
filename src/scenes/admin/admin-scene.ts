import Telegraf, { BaseScene, Extra, Markup } from 'telegraf'
import { ContextMessageUpdate, EventCategory } from '../../interfaces/app-interfaces'
import { i18nSceneHelper, isAdmin, sleep } from '../../util/scene-helper'
import TelegrafI18n from 'telegraf-i18n'
import { cardFormat } from '../shared/card-format'
import { getNextWeekEndRange, showBotVersion, syncrhonizeDbByUser } from '../shared/shared-logic'
import { db } from '../../db'
import { Paging } from '../shared/paging'
import { isValid, parse } from 'date-fns'
import { CallbackButton } from 'telegraf/typings/markup'
import { StatByReviewer } from '../../db/db-admin'

const scene = new BaseScene<ContextMessageUpdate>('admin_scene');

export interface AdminSceneState {
    cat?: EventCategory,
    reviewer?: string,
    overrideDate?: string
}

const { sceneHelper, actionName, i18nModuleBtnName} = i18nSceneHelper(scene)

const globalInterval = { start: new Date(2000, 1, 1), end: new Date(3000, 1, 1) }

const menuCats = [
    ['theaters', 'exhibitions'],
    ['movies', 'events'],
    ['walks', 'concerts']
]

function addReviewersMenu(statsByReviewer: StatByReviewer[], ctx: ContextMessageUpdate) {
    const {i18Btn, i18Msg} = sceneHelper(ctx)

    const btn = []
    let thisRow: CallbackButton[] = []
    statsByReviewer.forEach(({reviewer, count}) => {
        const icon = i18Msg(`admin_icons.${reviewer}`, undefined, '') || i18Msg('admin_icons.default');
        thisRow.push(Markup.callbackButton(i18Btn('byReviewer', {count, icon, reviewer}), actionName(`r_${reviewer}`)))
        if (thisRow.length == 2) {
            btn.push(thisRow)
            thisRow = []
        }
    })
    if (thisRow.length > 2) {
        btn.push(thisRow)
    }
    return btn
}

const content = async (ctx: ContextMessageUpdate) => {
    const {i18Btn, i18Msg, i18SharedBtn} = sceneHelper(ctx)

    const statsByName = await db.repoAdmin.findStatsByCat(globalInterval)

    let adminButtons = menuCats.map(row =>
        row.map(btnName => {
            const count = statsByName.find(r => r.category === btnName)
            return Markup.callbackButton(i18Btn(btnName, { count: count === undefined ? 0 : count.count }), actionName(btnName));
        })
    );

    const statsByReviewer = await db.repoAdmin.findStatsByReviewer(getNextWeekEndRange(ctx.now()))
    adminButtons = [...adminButtons, ...addReviewersMenu(statsByReviewer, ctx)]

    adminButtons.push([
        Markup.callbackButton(i18Btn('sync'), actionName('sync')),
        Markup.callbackButton(i18Btn('version'), actionName('version')),
    ])
    adminButtons.push([Markup.callbackButton(i18SharedBtn('back'), actionName('back'))])

    return {
        msg: i18Msg('welcome'),
        markup: Extra.HTML().markup(Markup.inlineKeyboard(adminButtons))
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
    .action(new RegExp(`${actionName('r_')}(.+)`), async (ctx: ContextMessageUpdate) => {
        // db.repoAdmin.findAllEventsByReviewer(ctx.match[1], getNextWeekEndRange(ctx.now()), )
        await ctx.answerCbQuery()
        await startNewPaging(ctx)
        ctx.session.adminScene.reviewer = ctx.match[1]
        await showNextResults(ctx)
    })

menuCats.flatMap(m => m).forEach(menuItem => {
    scene.action(actionName(menuItem), async (ctx: ContextMessageUpdate) => {
        await ctx.answerCbQuery()
        await startNewPaging(ctx)
        ctx.session.adminScene.cat = menuItem as EventCategory
        await showNextResults(ctx)
    })
})

async function getSearchedEvents(ctx: ContextMessageUpdate) {
    if (ctx.session.adminScene.cat !== undefined) {
        const stats = await db.repoAdmin.findStatsByCat(globalInterval)
        const total = stats.find(r => r.category === ctx.session.adminScene.cat).count
        const events = await db.repoAdmin.findAllEventsByCat(ctx.session.adminScene.cat, globalInterval, limitInAdmin, ctx.session.paging.pagingOffset)
        return {total, events}
    } else {
        const nextWeekEndRange = getNextWeekEndRange(ctx.now())
        const stats = await db.repoAdmin.findStatsByReviewer(nextWeekEndRange)
        const total = stats.find(r => r.reviewer === ctx.session.adminScene.reviewer).count
        const events = await db.repoAdmin.findAllEventsByReviewer(ctx.session.adminScene.reviewer, nextWeekEndRange, limitInAdmin, ctx.session.paging.pagingOffset)
        return {total, events}
    }
}

async function showNextResults(ctx: ContextMessageUpdate) {
    await prepareSessionStateIfNeeded(ctx)
    const {total, events} = await getSearchedEvents(ctx)

    const {i18Btn, i18Msg} = sceneHelper(ctx)

    const nextBtn = Markup.inlineKeyboard([
        Markup.callbackButton(i18Btn('show_more', {
            page: Math.ceil(ctx.session.paging.pagingOffset / limitInAdmin) + 1,
            total: Math.ceil(+total / limitInAdmin)
        }), actionName('show_more'))
    ])

    let count = 0
    for (const event of events) {
        await ctx.replyWithHTML(cardFormat(event, { showAdminInfo: true }), {
            disable_web_page_preview: true,
            reply_markup: (++count == events.length && events.length === limitInAdmin ? nextBtn : undefined)
        })
        await sleep(200)
    }
}


async function startNewPaging(ctx: ContextMessageUpdate) {
    await prepareSessionStateIfNeeded(ctx)
    ctx.session.adminScene.cat = undefined
    ctx.session.adminScene.reviewer = undefined
    Paging.reset(ctx)
}

async function prepareSessionStateIfNeeded(ctx: ContextMessageUpdate) {
    if (!ctx.scene.current) {
        await ctx.scene.enter('admin_scene', undefined, true)
    }
    Paging.prepareSession(ctx)
    if (ctx.session.adminScene === undefined) {
        ctx.session.adminScene = {
            cat: undefined,
            reviewer: undefined,
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