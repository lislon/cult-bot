import Telegraf, { BaseScene, Extra, Markup } from 'telegraf'
import { ContextMessageUpdate, EventCategory } from '../../interfaces/app-interfaces'
import { i18nSceneHelper, sleep } from '../../util/scene-helper'
import TelegrafI18n from 'telegraf-i18n'
import { cardFormat } from '../shared/card-format'
import { mskMoment } from '../../util/moment-msk'
import { showBotVersion, syncrhonizeDbByUser } from '../shared/shared-logic'
import { db } from '../../db'

const scene = new BaseScene<ContextMessageUpdate>('admin_scene');

const { sceneHelper, actionName, i18nModuleBtnName} = i18nSceneHelper(scene)

const globalInterval = [mskMoment('2000-01-01'), mskMoment('2025-01-01')]

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

scene
    .enter(async (ctx: ContextMessageUpdate) => {
        prepareSessionStateIfNeeded(ctx)

        const {msg, markup} = await content(ctx)
        await ctx.replyWithMarkdown(msg, markup)
    })
    .action(actionName('sync'), async (ctx: ContextMessageUpdate) => {
        await ctx.answerCbQuery()
        await syncrhonizeDbByUser(ctx)
    })
    .action(actionName('version'), async (ctx: ContextMessageUpdate) => {
        await ctx.answerCbQuery()
        await showBotVersion(ctx)
    })

menu.flatMap(m => m).forEach(menuItem => {
    scene.action(actionName(menuItem), async (ctx: ContextMessageUpdate) => {
        await ctx.answerCbQuery()
        const events = await db.repoAdmin.findAllEventsAdmin(menuItem as EventCategory, globalInterval)
        // let count = 0
        for (const event of events) {
            await ctx.replyWithHTML(cardFormat(event), {
                disable_web_page_preview: true,
                // reply_markup: (++count == events.length ? backMarkup(ctx) : undefined)
            })
            await sleep(200)
        }
    })
})


function prepareSessionStateIfNeeded(ctx: ContextMessageUpdate) {
    if (ctx.session.customize === undefined) {

    }
}

function registerActions(bot: Telegraf<ContextMessageUpdate>, i18n: TelegrafI18n) {
    bot.command('admin', (async (ctx: ContextMessageUpdate) => {
        await ctx.scene.enter('admin_scene');
    }))
}

export {
    scene as adminScene,
    registerActions as adminRegisterActions
}

export interface AdminSceneState {
}
