import { BaseScene, Extra, Markup } from 'telegraf'
import { ContextMessageUpdate } from '../../interfaces/app-interfaces'
import { CallbackButton } from 'telegraf/typings/markup'
import { i18nSceneHelper } from '../../util/scene-helper'
import { SceneRegister } from '../../middleware-utils'

const scene = new BaseScene<ContextMessageUpdate>('timetable');

const {backButton, sceneHelper, actionName, pushEnterScene, i18Btn, i18Msg} = i18nSceneHelper(scene)

const content = (ctx: ContextMessageUpdate) => {
    const [week6, week7] = ctx.session.timetable.weekSlots

    const {i18Btn, i18Msg} = sceneHelper(ctx)


    function formatInterval(slots: string[]) {
        if (slots === undefined) {
            return i18Btn('disabled')
        }
        if (slots.length === 0) {
            return i18Btn('weekend')
        }
        slots.sort()

        const final = [];
        let lastFrom: string = undefined
        let lastTo: string = undefined

        for (const slot of slots) {
            const [from, to] = slot.split('-')
            if (lastFrom === undefined) {
                lastFrom = from
                lastTo = to
                continue
            }

            if (from === lastTo) {
                lastTo = to
                continue
            } else {
                final.push(`${lastFrom}-${lastTo}`)
                lastFrom = from
                lastTo = to
            }
        }
        if (lastFrom !== undefined) {
            final.push(`${lastFrom}-${lastTo}`)
        }
        return final.join(', ')
    }

    const rows: CallbackButton[][] = [
        [
            Markup.callbackButton(i18Btn('week6'), actionName('interval_0')),
        ],
        [
            Markup.callbackButton(i18Btn('week7'), actionName('interval_1')),
        ],
        [
            Markup.callbackButton('◀ Продолжить настройки', actionName('back')),
            Markup.callbackButton('Выдать события', actionName('ok')),
        ]
    ]

    return {
        msg: i18Msg('timetable_select'),
        markup: Extra.HTML(true).markup(Markup.inlineKeyboard(rows))
    }
}

scene
    .enter(async (ctx: ContextMessageUpdate) => {
        if (ctx.session.timetable === undefined) {
            ctx.session.timetable = {
                weekSlots: [
                    ['15:00-16:00', '16:00-17:00'],
                    []
                ],
            }
        }

        const {msg, markup} = content(ctx)
        ctx.session.timetable.messageId = (await ctx.replyWithMarkdown(msg, markup)).message_id
    })
    .action(/timetable.interval_(\d)/, async (ctx: ContextMessageUpdate) => {
        const {i18Msg} = sceneHelper(ctx)

        const interval = +ctx.match[1]
        if (interval === 0) {
            ctx.session.timeInterval = {
                weekday: i18Msg('week6'),
                intervals: ctx.session.timetable.weekSlots[0]
            }
        } else {
            ctx.session.timeInterval = {
                weekday: i18Msg('week7'),
                intervals: ctx.session.timetable.weekSlots[1]
            }
        }
        await pushEnterScene(ctx, 'time_interval')
    })

export interface TimetableSceneState {
    weekSlots: string[][]
    messageId?: number
}

export const timeTableScene = {
    scene,
    postStageActionsFn: () => {
    }
} as SceneRegister
