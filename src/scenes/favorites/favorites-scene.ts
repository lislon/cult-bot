import { BaseScene, Composer, Extra, Markup } from 'telegraf'
import { ContextMessageUpdate, Event } from '../../interfaces/app-interfaces'
import { i18nSceneHelper } from '../../util/scene-helper'
import { db } from '../../database/db'
import { SceneRegister } from '../../middleware-utils'
import { forceSaveUserDataInDb } from '../../lib/middleware/user-middleware'
import { updateLikeDislikeInlineButtons } from '../likes/likes-common'
import { generatePlural, warnAdminIfDateIsOverriden } from '../shared/shared-logic'
import { MomentIntervals, rightDate } from '../../lib/timetable/intervals'
import { parseAndPredictTimetable } from '../../lib/timetable/timetable-utils'
import { last, partition } from 'lodash'
import { isAfter } from 'date-fns'

const scene = new BaseScene<ContextMessageUpdate>('favorites_scene');

const {i18nModuleBtnName, i18Btn, i18Msg, i18SharedBtn, backButton, actionName} = i18nSceneHelper(scene)

export interface FavoritesState {

}

async function getListOfFavorites(ctx: ContextMessageUpdate) {
    const events = await db.repoEventsCommon.getFavorites(ctx.session.user.eventsFavorite.reverse())

    function hasEventsInFuture(timeIntervals: MomentIntervals, date: Date) {
        return timeIntervals.length > 0 && isAfter(rightDate(last(timeIntervals)), date)
    }

    const [activeEvents, pastEvents] = partition(events, e => {
        const parsed = parseAndPredictTimetable(e.timetable, ctx.now())
        return hasEventsInFuture(parsed.timeIntervals, ctx.now())
    })

    const rows = []

    function prepareList(active: Event[]) {
        return active.map(({title}) => i18Msg(ctx, 'event_item', {title})).join('\n')
    }


    if (activeEvents.length > 0 && pastEvents.length === 0) {
        rows.push(i18Msg(ctx, 'list_no_group', {list: prepareList(activeEvents)}))
    } else {
        if (activeEvents.length > 0) {
            rows.push(i18Msg(ctx, 'list_group_actual', {list: prepareList(activeEvents)}))
        }
        if (pastEvents.length > 0) {
            rows.push(i18Msg(ctx, 'list_group_past', {list: prepareList(pastEvents)}))
        }
    }

    return rows.join('\n\n');

}

scene
    .enter(async (ctx: ContextMessageUpdate) => {
        const markupWithBackButton = Extra.HTML().markup(Markup.keyboard([[backButton(ctx)]]).resize())
        if (ctx.session.user.eventsFavorite.length === 0) {
            await ctx.replyWithHTML(i18Msg(ctx, 'empty_list'), markupWithBackButton)
        } else {
            await ctx.replyWithHTML(i18Msg(ctx, 'header'), markupWithBackButton)
            await warnAdminIfDateIsOverriden(ctx)
            await ctx.replyWithHTML(
                i18Msg(ctx, 'main', {
                    eventsPlural: generatePlural(ctx, 'event', ctx.session.user.eventsFavorite.length),
                    body: await getListOfFavorites(ctx)
                }),
                Extra.markup(Markup.inlineKeyboard(
                    [
                        [
                            Markup.callbackButton(i18Btn(ctx, 'show_actual'), actionName('show_actual')),
                            Markup.callbackButton(i18Btn(ctx, 'wipe'), actionName('wipe'))
                        ]
                    ],
                )))
        }
        ctx.ua.pv({dp: `/favorites/`, dt: `Избранное`})
    })
    .leave((ctx: ContextMessageUpdate) => {
    })

function postStageActionsFn(bot: Composer<ContextMessageUpdate>) {
    bot
        .action(/^favorite_(\d+)/, async (ctx: ContextMessageUpdate) => {
            const eventId = +ctx.match[1]

            if (ctx.session.user.eventsFavorite.includes(eventId)) {
                ctx.session.user.eventsFavorite = ctx.session.user.eventsFavorite.filter(id => id !== eventId)
                await ctx.answerCbQuery(i18Msg(ctx, 'cb_answer_unfavorited'))
            } else {
                ctx.session.user.eventsFavorite.push(eventId)
                await ctx.answerCbQuery(i18Msg(ctx, 'cb_answer_favorited'))
            }
            forceSaveUserDataInDb(ctx)
            await db.task(async dbtask => await updateLikeDislikeInlineButtons(ctx, dbtask, eventId))
        })
        .action(actionName('wipe'), async ctx => {
            await ctx.answerCbQuery(i18Msg(ctx, 'cb_answer_wiped'))
            ctx.session.user.eventsFavorite = []
        })
        .action(actionName('show_actual'), async ctx => {
            await ctx.answerCbQuery()
        })
}

export const favoritesScene = {
    scene,
    postStageActionsFn
} as SceneRegister
