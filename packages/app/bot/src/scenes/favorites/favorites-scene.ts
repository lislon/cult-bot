import { Composer, Markup, Scenes } from 'telegraf'
import { ContextMessageUpdate, Event } from '../../interfaces/app-interfaces'
import { i18nSceneHelper } from '../../util/scene-helper'
import { db } from '../../database/db'
import { SceneRegister } from '../../middleware-utils'
import { forceSaveUserDataInDb } from '../../lib/middleware/user-middleware'
import { isEventInFavorites, updateLikeDislikeInlineButtons } from '../likes/likes-common'
import {
    buttonIsOldGoToMain,
    editMessageAndButtons,
    extraInlineMenu,
    generatePlural,
    getInlineKeyboardFromCallbackQuery,
    getMsgId,
    replyWithBackToMainMarkup,
    updateKeyboardButtons,
    warnAdminIfDateIsOverriden
} from '../shared/shared-logic'
import { ParseAndPredictTimetableResult } from '../../lib/timetable/timetable-utils'
import { cardFormat } from '../shared/card-format'
import { SliderPager } from '../shared/slider-pager'
import { FavoritesPagerConfig } from './favorites-pager-config'
import { loadEventsAsFavorite, removeFavoriteButton, sortFavorites } from './favorites-common'
import { InlineKeyboardButton } from 'typegram'
import { formatListOfFavorites } from './favorites-format'

const scene = new Scenes.BaseScene<ContextMessageUpdate>('favorites_scene')

const {i18SharedMsg, i18Btn, i18Msg, i18SharedBtn, backButton, actionName, actionNameRegex} = i18nSceneHelper(scene)

export interface FavoriteEvent extends Event {
    parsedTimetable: ParseAndPredictTimetableResult
    firstDate: Date
    isFuture: boolean
}

async function getMainMenu(ctx: ContextMessageUpdate): Promise<{ msg: string; buttons: InlineKeyboardButton.CallbackButton[][] }> {
    let msg
    let buttons: InlineKeyboardButton.CallbackButton[][] = []
    const events = sortFavorites(await loadEventsAsFavorite(ctx.session.user.eventsFavorite, ctx.now()))

    const back = backButton()
    if (events.length > 0) {
        const wipeButton = Markup.button.callback(i18Btn(ctx, 'wipe'), actionName('wipe'))
        const showCards = Markup.button.callback(i18Btn(ctx, 'show_cards', {count: events.length}), actionName('show_cards'))

        const hasOld = events.find(e => e.isFuture === false) !== undefined

        buttons = [[showCards], [...(hasOld ? [wipeButton] : [])], [back]]

        msg = i18Msg(ctx, 'main', {
            eventsPlural: generatePlural(ctx, 'event', events.length),
            list: await formatListOfFavorites(ctx, events, ctx.now())
        })
    } else {
        msg = i18Msg(ctx, 'empty_list')
        buttons = [[back]]
    }

    return {msg, buttons}
}


scene
    .enter(async ctx => {
        await replyWithBackToMainMarkup(ctx, i18Msg(ctx, 'markup_back_decoy'))

        await warnAdminIfDateIsOverriden(ctx)

        const {msg, buttons} = await getMainMenu(ctx)
        await ctx.replyWithHTML(msg, extraInlineMenu(buttons))

        ctx.ua.pv({dp: `/favorites/`, dt: `Избранное`})
    })

async function toggleFavoriteButtonLogic(ctx: ContextMessageUpdate, eventId: number) {
    const [{title}] = await db.repoEventsCommon.getEventsByIds([eventId])
    if (ctx.session.user.eventsFavorite.includes(eventId)) {
        ctx.session.user.eventsFavorite = ctx.session.user.eventsFavorite.filter(id => id !== eventId)
        await ctx.answerCbQuery(i18Msg(ctx, 'cb_answer_unfavorited', {title}))
    } else {
        ctx.session.user.eventsFavorite.push(eventId)
        await ctx.answerCbQuery(i18Msg(ctx, 'cb_answer_favorited', {title}))
    }
    forceSaveUserDataInDb(ctx)
}

const eventPager = new SliderPager(new FavoritesPagerConfig())

function removeFromFavorite(ctx: ContextMessageUpdate, eventId: number) {
    ctx.session.user.eventsFavorite = ctx.session.user.eventsFavorite.filter(e => e !== eventId)
}

function postStageActionsFn(bot: Composer<ContextMessageUpdate>): void {
    bot
        .action(/^favorite_(\d+)/, async ctx => {
            const eventId = +ctx.match[1]

            await toggleFavoriteButtonLogic(ctx, eventId)
            await db.task(async dbtask => await updateLikeDislikeInlineButtons(ctx, dbtask, eventId))
        })
        .action(actionNameRegex(/(restore|remove)_(\d+)/), async ctx => {
            const action = ctx.match[1] as 'restore' | 'remove'
            const eventId = +ctx.match[2]

            const [event] = await loadEventsAsFavorite([eventId], ctx.now())

            if (eventPager.isThisSliderValid(ctx)) {

                if (event !== undefined) {

                    let cardBtnIsFresh = true

                    if (!isEventInFavorites(ctx, eventId) && action === 'restore') {
                        ctx.session.user.eventsFavorite.push(eventId)
                        cardBtnIsFresh = false
                    } else if (isEventInFavorites(ctx, eventId) && action === 'remove') {
                        removeFromFavorite(ctx, eventId)
                        eventPager.getSliderState(ctx)

                        cardBtnIsFresh = false
                    }

                    if (!cardBtnIsFresh) {
                        await eventPager.updateState(ctx, {invalidateOtherSliders: true})

                        const card = cardFormat(event, {deleted: !isEventInFavorites(ctx, eventId), now: ctx.now()})
                        let newKeyboard = getInlineKeyboardFromCallbackQuery(ctx)

                        newKeyboard = await updateKeyboardButtons(newKeyboard, /(restore|remove)/, () => {
                            return removeFavoriteButton(ctx, event)
                        })

                        await ctx.editMessageText(card, {
                            disable_web_page_preview: true,
                            parse_mode: 'HTML',
                            reply_markup: newKeyboard
                        })

                    } else {
                        await ctx.answerCbQuery('Уже ок')
                    }

                } else {
                    await buttonIsOldGoToMain(ctx)
                }
            } else {
                await eventPager.answerCbSliderIsOld(ctx)
            }
        })
        .action(actionName('wipe'), async ctx => {
            const events = await loadEventsAsFavorite(ctx.session.user.eventsFavorite, ctx.now())
            const pastEvents = events.filter(e => !e.isFuture)

            await ctx.answerCbQuery(i18Msg(ctx, 'cb_answer_wiped', {
                count: pastEvents.length
            }))

            ctx.session.user.eventsFavorite = ctx.session.user.eventsFavorite
                .filter(favoriteEventId => pastEvents.find(past => past.id === favoriteEventId) === undefined)

            if (pastEvents.length > 0) {
                const {msg, buttons} = await getMainMenu(ctx)
                await editMessageAndButtons(ctx, buttons, msg)
            }
        })
        .action(actionName('show_cards'), async ctx => {
            await ctx.answerCbQuery()

            const state = await eventPager.updateState(ctx, {invalidateOtherSliders: true, msgId: getMsgId(ctx)})
            await eventPager.showOrUpdateSlider(ctx, state)
        })
        .action(actionName('back_to_favorite_main'), async ctx => {
            await ctx.answerCbQuery()
            const {msg, buttons} = await getMainMenu(ctx)
            await editMessageAndButtons(ctx, buttons, msg)
        })
        .use(eventPager.middleware())
}

export const favoritesScene: SceneRegister = {
    scene,
    postStageActionsFn
}