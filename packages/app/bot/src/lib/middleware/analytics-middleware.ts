import { ContextMessageUpdate, Event } from '../../interfaces/app-interfaces'
import ua from 'universal-analytics'
import { v4 as generateUuid } from 'uuid'
import { botConfig } from '../../util/bot-config'
import { db } from '../../database/db'
import { logger } from '../../util/logger'
import { getResponsePerformance } from './performance-middleware'
import { Scenes } from 'telegraf'
import { Update } from 'typegram'
import { isAdmin } from '../../util/scene-utils'
import { i18nSceneHelper } from '../../util/scene-helper'

const {i18SharedMsg} = i18nSceneHelper(new Scenes.BaseScene<ContextMessageUpdate>(''))

export interface AnalyticsState {
    markupClicks: number
    inlineClicks: number
}

export interface AnalyticsStateTmp {
    viewedEvents: number[]
    referral?: string
}

export function countInteractions(ctx: ContextMessageUpdate): number {
    return ctx.session.analytics.markupClicks + ctx.session.analytics.inlineClicks
}

function prepareSessionStateIfNeeded(ctx: ContextMessageUpdate) {
    const {
        markupClicks,
        inlineClicks
    } = ctx.session.analytics || {}

    ctx.session.analytics = {
        markupClicks: markupClicks || 0,
        inlineClicks: inlineClicks || ctx.session.user.clicks || 0,
    }

    ctx.sessionTmp.analyticsScene = {
        viewedEvents: []
    }
}

function shouldCountStatForUser(ctx: ContextMessageUpdate) {
    return botConfig.GOOGLE_ANALYTICS_COUNT_ADMINS === true || !isAdmin(ctx)
}

export const analyticsMiddleware = async (ctx: ContextMessageUpdate, next: any) => {
    if (ctx.session.user.uaUuid === undefined) {
        ctx.session.user.uaUuid = generateUuid()
    }
    ctx.ua = ua(botConfig.GOOGLE_ANALYTICS_ID, ctx.session.user.uaUuid)
    ctx.ua.set('ds', 'app')

    prepareSessionStateIfNeeded(ctx)

    function isCallbackQuery(update: Update): update is Update.CallbackQueryUpdate {
        return 'callback_query' in update
    }

    if (ctx.message !== undefined && 'text' in ctx.message && !ctx.message.text?.startsWith('/start')) {
        ctx.ua.e('Button', 'type', ctx.message.text, undefined)
        ctx.session.analytics.inlineClicks++
    } else {
        const update = ctx.update
        if (isCallbackQuery(update)) {
            if ('message' in update.callback_query) {
                const message = update.callback_query.message as any
                const replyMarkup = message.reply_markup
                const inlineKeyboard = replyMarkup.inline_keyboard

                const buttonText = inlineKeyboard
                    .flatMap((kbRows: any) => kbRows)
                    .find(({callback_data}: any) => callback_data === (update.callback_query as any)?.data)

                if (buttonText !== undefined) {
                    ctx.ua.e('Button', 'click', buttonText.text, undefined)
                }
                ctx.session.analytics.inlineClicks++
            }
        }
    }

    try {
        return await next()
    } catch (e) {
        if (ctx.ua !== undefined) {
            ctx.ua.exception(e.message, false)
        }
        throw e
    } finally {
        if (ctx.perf !== undefined && ctx.perf.timeBeforeFirstMsg !== undefined && ctx.ua !== undefined) {
            ctx.ua.timing(ctx.perf.scene ?? 'no_scene', 'first response', Math.ceil(getResponsePerformance(ctx)))
        }
        if (botConfig.GOOGLE_ANALYTICS_ID !== undefined) {

            if (shouldCountStatForUser(ctx)) {
                ctx.ua.send()
            }
        }

        if (botConfig.LOG_PAGE_VIEWS_IN_DB) {
            try {
                await db.repoEventsCommon.logViews(ctx.sessionTmp.analyticsScene.viewedEvents)
            } catch (e) {
                logger.error(e)
            }
        }

    }
}


export function googleAnalyticRecordReferral(ctx: ContextMessageUpdate, referral: string): void {
    if (ctx.sessionTmp) {
        ctx.sessionTmp.analyticsScene.referral = referral
        ctx.ua.set('cs', referral)
    }
}

export function analyticRecordEventView(ctx: ContextMessageUpdate, event: Event): void {
    if (ctx.sessionTmp) {
        const label = `${i18SharedMsg(ctx, `category_icons.${event.category}`)} ${event.extId} ${event.title} [${event.place}]`
        ctx.ua.event('Card View', 'view', label, undefined)
        ctx.sessionTmp.analyticsScene.viewedEvents.push(+event.id)
    }
}