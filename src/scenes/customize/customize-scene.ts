import { BaseScene, Extra, Markup } from 'telegraf'
import { ContextMessageUpdate } from '../../interfaces/app-interfaces'
import { backButtonRegister } from '../../util/scene-helper'

const customizeScene = new BaseScene<ContextMessageUpdate>('customize');

const { backButton, sceneHelper, actionName, onActionPushScene } = backButtonRegister(customizeScene)

onActionPushScene(actionName('timetable'), 'timetable')



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
            Markup.callbackButton(i18Btn('timetable'), actionName('timetable')),
            Markup.callbackButton(i18Btn('oblasti'), actionName('oblasti')),
            Markup.callbackButton(i18Btn('cennosti'), actionName('cennosti'))
        ],
        [backButton(ctx)],
    ]

    return {
        msg: lines.join('\n'),
        markup: Extra.HTML(true).markup(Markup.inlineKeyboard(keyboard))
    }
}

customizeScene.enter(async (ctx: ContextMessageUpdate) => {
    if (ctx.session.customize === undefined) {
        ctx.session.customize = {
            hoursFrom: '12:00',
            hoursTo: '18:00',
            hour: 12,
            nothingNum: 0
        }
    }

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

customizeScene.action(actionName('oblasti'), nothing)
customizeScene.action(actionName('cennosti'), nothing)

export { customizeScene }

export interface CustomizeSceneState {
    hoursFrom: string,
    hoursTo: string,
    messageId?: number,
    hour: number,
    nothingNum: number
}
