import { BaseScene, Extra, Markup } from 'telegraf'
import { ContextMessageUpdate } from '../../interfaces/app-interfaces'
import { i18nSceneHelper } from '../../util/scene-helper'

const scene = new BaseScene<ContextMessageUpdate>('time_interval');

export interface TimeIntervalSceneState {
    weekday: string
    intervals: string[]
    messageId?: number
}

const { backButton, sceneHelper, actionName } = i18nSceneHelper(scene)

enum Actions {
    ALL_DAY = 'slot_all_day'
}

const MIN_HOUR = 8
const MAX_HOUR = 20

function padTime(startHour: number) {
    return `${startHour}`.padStart(2, '0')
}

const content = (ctx: ContextMessageUpdate) => {

    const { i18Btn, i18Msg } = sceneHelper(ctx)

    const getButtonForSlot = (ctx: ContextMessageUpdate, startHour: number, selectedSlots: string[]) => {
        const from = padTime(startHour)
        const to = padTime(startHour + 1)

        const text = i18Btn((selectedSlots || []).includes(`${from}:00-${to}:00`) ? 'slot_selected' : 'slot', {from, to});
        return Markup.callbackButton(text, actionName(`slot_${startHour}`))
    }

    const allDayText = ctx.session.timeInterval.intervals.length == MAX_HOUR - MIN_HOUR + 1 ? 'all_day_selected' : 'all_day'

    const rows = [
        [Markup.callbackButton(i18Btn(allDayText), actionName(Actions.ALL_DAY))]
    ]


    for (let startHour = MIN_HOUR; startHour <= MAX_HOUR; startHour++) {
        rows.push([getButtonForSlot(ctx, startHour, ctx.session.timeInterval.intervals)])
    }
    // rows.push([backButton(ctx)])

    return {
        msg: i18Msg('interval_select', { weekday: ctx.session.timeInterval.weekday }),
        markup: Extra.HTML(true).markup(Markup.inlineKeyboard(rows))
    }
}

scene.enter(async (ctx: ContextMessageUpdate) => {
    if (ctx.session.timeInterval === undefined) {
        ctx.session.timeInterval = {
            weekday: '???',
            intervals: [],
            messageId: undefined
        }
    }

    const {msg, markup} = content(ctx)

    ctx.session.timetable.messageId = (await ctx.replyWithMarkdown(msg, markup)).message_id
})


scene.action(/time_interval[.]slot_(\d+|all_day)/, async (ctx: ContextMessageUpdate) => {
    const slot = ctx.match[1]

    function makeInterval(startHour: number) {
        return `${padTime(startHour)}:00-${padTime(startHour + 1)}:00`
    }

    if (slot === 'all_day') {
        if (ctx.session.timeInterval.intervals.length == MAX_HOUR - MIN_HOUR + 1) {
            ctx.session.timeInterval.intervals = []
        } else {
            ctx.session.timeInterval.intervals = []
            for (let startHour = MIN_HOUR; startHour <= MAX_HOUR; startHour++) {
                ctx.session.timeInterval.intervals.push(makeInterval(startHour))
            }
        }
    } else {
        const interval = makeInterval(+slot);
        if (ctx.session.timeInterval.intervals.includes(interval)) {
            ctx.session.timeInterval.intervals = ctx.session.timeInterval.intervals
                .filter(i => i !== interval)
        } else {
            ctx.session.timeInterval.intervals.push(interval)
        }
    }
    const {msg, markup} = content(ctx)

    await ctx.editMessageText(msg, markup.inReplyTo(ctx.session.timetable.messageId))
})

export { scene as timeIntervalScene }
