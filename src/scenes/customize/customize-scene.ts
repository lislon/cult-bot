import Telegraf, { BaseScene, Composer, Extra, Markup } from 'telegraf'
import { allCategories, ContextMessageUpdate, EventCategory } from '../../interfaces/app-interfaces'
import { backButtonRegister } from '../../util/scene-helper'
import TelegrafI18n from "telegraf-i18n"
import { loadAllCennosti, loadAllOblasti } from '../../db/events'
import { createHash } from 'crypto'

const scene = new BaseScene<ContextMessageUpdate>('customize_scene');

const { backButton, sceneHelper, actionName, onActionPushScene } = backButtonRegister(scene)



const content = (ctx: ContextMessageUpdate) => {

    const { i18Btn, i18Msg } = sceneHelper(ctx)

    const lines = [
        `Рекомендовать мне все события:`,
        '',
        '<i>...тут надо придумать что писать...</i>',
        '',
        `<b>Время</b>: `,
        `  - в субботу ${ctx.session.customize.hoursFrom}-${ctx.session.customize.hoursTo}`,
        `  - в воскресенье: 12-18`,
        '',
        '<b>Ценности</b>: #комфорт #новыеформы  #доступноподеньгам #влюбоевремя',
    ]

    const keyboard = [
        [
            Markup.button(i18Btn('timetable')),
            Markup.button(i18Btn('oblasti')),
            Markup.button(i18Btn('cennosti'))
        ],
        [backButton(ctx)],
    ]

    return {
        msg: lines.join('\n'),
        markup: Extra.HTML(true).markup(Markup.keyboard(keyboard).resize())
    }
}

function registerActions(bot: Telegraf<ContextMessageUpdate>, i18n: TelegrafI18n) {
    bot.hears(i18n.t(`ru`, `scenes.customize_scene.keyboard.oblasti`), async (ctx: ContextMessageUpdate) => {
        await prepareSessionStateIfNeeded(ctx)
        const strings = await loadAllOblasti()

        const keyboard = Markup.keyboard(strings, {
             columns: 2
         })

        await ctx.replyWithHTML('Oblsati: ' + strings.join(', '), Extra.markup(keyboard.resize()))
    });

    bot.hears(i18n.t(`ru`, `scenes.customize_scene.keyboard.cennosti`), async (ctx: ContextMessageUpdate) => {
        await prepareSessionStateIfNeeded(ctx)
        const strings = await loadAllCennosti()

        const keyboard = Markup.keyboard(strings, {
            columns: 2
        })

        await ctx.replyWithHTML('Cennosti: ' + strings.join(', '), Extra.markup(keyboard.resize()))
    });


}




function prepareSessionStateIfNeeded(ctx: ContextMessageUpdate) {
    if (ctx.session.customize === undefined) {
        ctx.session.customize = {
            hoursFrom: '12:00',
            hoursTo: '18:00',
            hour: 12,
            nothingNum: 0
        }
    }
}

scene.enter(async (ctx: ContextMessageUpdate) => {
    prepareSessionStateIfNeeded(ctx)

    const {msg, markup} = content(ctx)
    ctx.session.customize.messageId = (await ctx.replyWithMarkdown(msg, markup)).message_id
})

async function nothing(ctx: ContextMessageUpdate) {

    switch (ctx.session.customize.nothingNum++) {
        case 0:
            await ctx.reply('Пока тут ничего нет :(')
            break
        case 1:
            await ctx.reply('И тут тоже :(')
            break
        default:
            await ctx.reply('И тут :(')
            break
    }
}

scene.action(actionName('oblasti'), nothing)
scene.action(actionName('cennosti'), nothing)

export {
    scene as customizeScene,
    registerActions as customizeRegisterActions
}

export interface CustomizeSceneState {
    hoursFrom: string,
    hoursTo: string,
    messageId?: number,
    hour: number,
    nothingNum: number
}
