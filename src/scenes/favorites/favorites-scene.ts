import { BaseScene, Composer, Markup } from 'telegraf'
import { ContextMessageUpdate, Event } from '../../interfaces/app-interfaces'
import { i18nSceneHelper } from '../../util/scene-helper'
import { db, LimitOffset } from '../../database/db'
import { SceneRegister } from '../../middleware-utils'
import { forceSaveUserDataInDb } from '../../lib/middleware/user-middleware'
import { getLikeDislikeButtonText, updateLikeDislikeInlineButtons } from '../likes/likes-common'
import {
    editMessageAndButtons,
    extraInlineMenu,
    generatePlural,
    getMsgInlineKeyboard,
    parseAndUpdateBtn,
    replyWithBackToMainMarkup,
    ruFormat,
    SessionEnforcer,
    warnAdminIfDateIsOverriden
} from '../shared/shared-logic'
import { leftDate, MomentIntervals, rightDate } from '../../lib/timetable/intervals'
import { parseAndPredictTimetable, ParseAndPredictTimetableResult } from '../../lib/timetable/timetable-utils'
import { first, last } from 'lodash'
import { compareAsc, compareDesc, isAfter } from 'date-fns'
import { PagingConfig, PagingPager } from '../shared/paging-pager'
import { addHtmlNiceUrls, cardFormat, formatTimetable } from '../shared/card-format'
import { CallbackButton } from 'telegraf/typings/markup'
import { InlineKeyboardMarkup } from 'telegram-typings'
import { fieldIsQuestionMarkOrEmpty } from '../../util/misc-utils'
import { escapeHTML } from '../../util/string-utils'

const scene = new BaseScene<ContextMessageUpdate>('favorites_scene')

const {i18SharedMsg, i18Btn, i18Msg, i18SharedBtn, backButton, actionName} = i18nSceneHelper(scene)

export interface FavoritesState {
    viewType: 'compact' | 'detailed'
}

export interface FavoriteEvent extends Event {
    parsedTimetable: ParseAndPredictTimetableResult
    firstDate: Date
    isFuture: boolean
}

function sortFavorites(events: FavoriteEvent[]) {
    return events.sort((left, right) => {
            if (left.isFuture === true && right.isFuture === true) {

                if (left.parsedTimetable.timetable.anytime === false && right.parsedTimetable.timetable.anytime === false) {
                    return compareAsc(left.firstDate, right.firstDate)
                } else if (left.parsedTimetable.timetable.anytime === true) {
                    return 1
                } else if (right.parsedTimetable.timetable.anytime === true) {
                    return -1
                } else {
                    return 0
                }

            } else if (left.isFuture === false && right.isFuture === false) {
                return compareDesc(left.firstDate, right.firstDate)
            } else {
                return left.isFuture ? -1 : 1
            }
        }
    )
}

async function getListOfFavorites(ctx: ContextMessageUpdate, eventIds: number[]): Promise<FavoriteEvent[]> {
    function hasEventsInFuture(timeIntervals: MomentIntervals, date: Date) {
        return timeIntervals.length > 0 && isAfter(rightDate(last(timeIntervals)), date)
    }

    const events = await db.repoEventsCommon.getEventsByIds(eventIds)

    const eventsWithNearestDate = events.map(e => {
        const parsedTimetable = parseAndPredictTimetable(e.timetable, ctx.now())
        return {
            ...e,
            parsedTimetable,
            firstDate: parsedTimetable.timeIntervals.length > 0 ? leftDate(first(parsedTimetable.timeIntervals)) : new Date(0),
            isFuture: hasEventsInFuture(parsedTimetable.timeIntervals, ctx.now())
        } as FavoriteEvent
    })

    return eventsWithNearestDate
}

function nearestDate(now: Date, event: FavoriteEvent) {
    return first(event.parsedTimetable.timeIntervals.map(rightDate).filter(rightDate => isAfter(rightDate, now)))
}

async function formatListOfFavorites(ctx: ContextMessageUpdate, events: FavoriteEvent[]) {
    return events.map(event => {
        if (event.isFuture) {
            const date = event.parsedTimetable.timetable.anytime ? i18Msg(ctx, 'date_anytime') : ruFormat(nearestDate(ctx.now(), event), 'dd MMMM')
            const timetable = formatTimetable(event).trimEnd()

            if (ctx.session.favorites.viewType === 'detailed') {


                const details = [timetable]
                if (!fieldIsQuestionMarkOrEmpty(event.place)) {
                    details.push(`🌐 ${addHtmlNiceUrls(escapeHTML(event.place))}\n`)
                }

                return i18Msg(ctx, 'event_item_detailed', {
                    icon: i18SharedMsg(ctx, 'category_icons.' + event.category),
                    title: event.title,
                    details: details.join('\n'),
                    date
                })
            } else {
                return i18Msg(ctx, 'event_item', {
                    icon: i18SharedMsg(ctx, 'category_icons.' + event.category),
                    title: event.title,
                    date
                })
            }
        } else {

            const date = event.parsedTimetable.timeIntervals.length === 0 ? '> 2 недель назад' : ruFormat(rightDate(last(event.parsedTimetable.timeIntervals)), 'dd MMMM')

            return i18Msg(ctx, 'event_item_past', {
                icon: i18SharedMsg(ctx, 'category_icons.' + event.category),
                title: event.title,
                date
            })
        }
    }).join('\n')
}

async function getMainMenu(ctx: ContextMessageUpdate) {
    let msg
    let buttons: CallbackButton[][] = []
    const events = sortFavorites(await getListOfFavorites(ctx, ctx.session.user.eventsFavorite))

    const back = backButton(ctx)
    if (events.length > 0) {
        const wipeButton = Markup.callbackButton(i18Btn(ctx, 'wipe'), actionName('wipe'))
        const showCards = Markup.callbackButton(i18Btn(ctx, 'show_cards', {count: events.length}), actionName('show_cards'))

        const viewType = Markup.callbackButton(i18Btn(ctx, 'view_type', {
            viewType: i18Btn(ctx, ctx.session.favorites.viewType === 'compact' ? 'view_type_compact' : 'view_type_detailed')
        }), actionName('view_type'))


        const hasOld = events.find(e => e.isFuture === false) !== undefined

        buttons = [[...(hasOld ? [wipeButton] : []), viewType], [back, showCards]]

        msg = i18Msg(ctx, 'main', {
            eventsPlural: generatePlural(ctx, 'event', events.length),
            list: await formatListOfFavorites(ctx, events)
        })
    } else {
        msg = i18Msg(ctx, 'empty_list')
        buttons = [[back]]
    }

    return {msg, buttons}
}

function cardButtonsRow(ctx: ContextMessageUpdate, event: Event) {
    return [
        Markup.callbackButton(getLikeDislikeButtonText(ctx, event.likes, 'like'), `like_${event.id}`),
        Markup.callbackButton(getLikeDislikeButtonText(ctx, event.dislikes, 'dislike'), `dislike_${event.id}`),
        Markup.callbackButton(i18Btn(ctx, 'remove_favorite'), `favorite_${event.id}`),
    ]
}

class FavoritePaging implements PagingConfig<number[]> {
    limit = 3
    sceneId = scene.id

    async loadCardsByIds(ctx: ContextMessageUpdate, ids: number[]): Promise<Event[]> {
        return await getListOfFavorites(ctx, ids)
    }

    async preloadIds(ctx: ContextMessageUpdate, snapshotFavoriteIds: number[], {offset, limit}: LimitOffset): Promise<number[]> {
        return snapshotFavoriteIds.slice(offset, offset + limit)
    }

    async getTotal(ctx: ContextMessageUpdate, snapshotFavoriteIds: number[]): Promise<number> {
        return snapshotFavoriteIds.length
    }

    async cardButtons?(ctx: ContextMessageUpdate, event: Event): Promise<CallbackButton[]> {
        return cardButtonsRow(ctx, event)
    }

    lastEventEndButton(ctx: ContextMessageUpdate): CallbackButton[] {
        return [Markup.callbackButton(i18Btn(ctx, 'back_to_favorite_main'), actionName(`back_to_favorite_main`))]
    }

    analytics(ctx: ContextMessageUpdate, events: Event[], {limit, offset}: LimitOffset) {
        const pageNumber = Math.floor(limit / offset) + 1

        const pageTitle = pageNumber > 1 ? ` [Страница ${pageNumber}]` : ''
        ctx.ua.pv({
            dp: `/favorites/${pageNumber > 1 ? `p${pageNumber}/` : ''}`,
            dt: `Избранное > Актуальные карточки ${pageTitle}`.trim()
        })
    }
}

const eventPager = new PagingPager(new FavoritePaging())

function prepareSessionStateIfNeeded(ctx: ContextMessageUpdate) {
    const {
        viewType
    } = ctx.session.favorites || {}

    ctx.session.favorites = {
        viewType: SessionEnforcer.default(viewType, 'compact')
    }
}

scene
    .enter(async (ctx: ContextMessageUpdate) => {
        await replyWithBackToMainMarkup(ctx)


        await warnAdminIfDateIsOverriden(ctx)
        prepareSessionStateIfNeeded(ctx)

        const {msg, buttons} = await getMainMenu(ctx)
        await ctx.replyWithHTML(msg, extraInlineMenu(buttons))

        ctx.ua.pv({dp: `/favorites/`, dt: `Избранное`})
    })
    .leave((ctx: ContextMessageUpdate) => {
        eventPager.reset(ctx)
    })
    .action(/^favorite_(\d+)/, async (ctx: ContextMessageUpdate) => {
        const eventId = +ctx.match[1]

        await toggleFavoriteButtonLogic(ctx, eventId)
        if (!ctx.session.user.eventsFavorite.includes(eventId)) {
            const [event] = await db.repoEventsCommon.getEventsByIds([eventId])
            if (event !== undefined) {

                let newKeyboard = (ctx.update.callback_query.message as any)?.reply_markup as InlineKeyboardMarkup

                newKeyboard = await parseAndUpdateBtn(newKeyboard, /^(like|dislike|favorite)_/, (btn) => undefined)

                await ctx.editMessageText(i18Msg(ctx, 'deleted_card', {
                    title: event.title,
                    icon: i18SharedMsg(ctx, 'category_icons.' + event.category),
                }), extraInlineMenu([
                    [Markup.callbackButton(i18Btn(ctx, 'restore'), actionName(`restore_${eventId}`))],
                    ...(newKeyboard.inline_keyboard as CallbackButton[][])
                ]))
            }
        }
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

function postStageActionsFn(bot: Composer<ContextMessageUpdate>) {
    bot
        .action(/^favorite_(\d+)/, async (ctx: ContextMessageUpdate) => {
            const eventId = +ctx.match[1]

            await toggleFavoriteButtonLogic(ctx, eventId)
            await db.task(async dbtask => await updateLikeDislikeInlineButtons(ctx, dbtask, eventId))
        })
        .action(/^favorites_scene.restore_(\d+)/, async (ctx: ContextMessageUpdate) => {
            await ctx.answerCbQuery()
            const eventId = +ctx.match[1]

            const [event] = await db.repoEventsCommon.getEventsByIds([eventId])
            if (event !== undefined) {

                if (!ctx.session.user.eventsFavorite.includes(eventId)) {
                    ctx.session.user.eventsFavorite.push(eventId)
                }

                const card = cardFormat(event)

                const originalKeyboard = getMsgInlineKeyboard(ctx)

                const newKeyboard = await parseAndUpdateBtn(originalKeyboard, /restore/, () => {
                    return cardButtonsRow(ctx, event)
                })

                await ctx.editMessageText(card, {
                    disable_web_page_preview: true,
                    parse_mode: 'HTML',
                    reply_markup: newKeyboard
                })
            }
        })
        .action(actionName('view_type'), async ctx => {
            await ctx.answerCbQuery()
            prepareSessionStateIfNeeded(ctx)
            ctx.session.favorites.viewType = ctx.session.favorites.viewType === 'compact' ? 'detailed' : 'compact'

            const {msg, buttons} = await getMainMenu(ctx)
            await editMessageAndButtons(ctx, buttons, msg)


            if (ctx.session.favorites.viewType === 'compact') {
                ctx.ua.pv({dp: `/favorites/compact/`, dt: `Избранное (с форматом времени)`})
            } else {
                ctx.ua.pv({dp: `/favorites/detailed/`, dt: `Избранное`})
            }
        })
        .action(actionName('wipe'), async ctx => {
            const events = await getListOfFavorites(ctx, ctx.session.user.eventsFavorite)
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
            await prepareSessionStateIfNeeded(ctx)

            await eventPager.updateState(ctx, ctx.session.user.eventsFavorite)
            await eventPager.initialShowCards(ctx)
        })
        .action(actionName('back_to_favorite_main'), async ctx => {
            await ctx.answerCbQuery()
            const {msg, buttons} = await getMainMenu(ctx)
            await editMessageAndButtons(ctx, buttons, msg, {forceNewMsg: true})
        })
        .use(eventPager.middleware())
}

export const favoritesScene = {
    scene,
    postStageActionsFn
} as SceneRegister