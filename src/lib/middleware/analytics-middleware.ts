import { ContextMessageUpdate, Event } from '../../interfaces/app-interfaces'
import ua from 'universal-analytics'
import { v4 as generateUuid } from 'uuid'
import { botConfig } from '../../util/bot-config'
import { i18nSceneHelper, isAdmin } from '../../util/scene-helper'
import { BaseScene } from 'telegraf'
import { db } from '../../database/db'
import { logger } from '../../util/logger'

export interface AnalyticsState {
    markupClicks: number
    inlineClicks: number
}

export interface AnalyticsStateTmp {
    viewedEvents: number[]
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
        inlineClicks: inlineClicks || 0,
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
    ctx.ua = ua(botConfig.GOOGLE_ANALYTICS_ID, ctx.session.user.uaUuid);
    ctx.ua.set('ds', 'app')

    prepareSessionStateIfNeeded(ctx)
    if (ctx.updateType === 'message' && ctx.updateSubTypes.includes('text') && !ctx.message.text?.startsWith('/start')) {
        ctx.ua.e('Button', 'type', ctx.message.text, undefined)
        ctx.session.analytics.markupClicks++
    } else if (ctx.updateType === 'callback_query') {
        const message = ctx.update.callback_query.message as any
        const replyMarkup = message.reply_markup
        const inlineKeyboard = replyMarkup.inline_keyboard

        const buttonText = inlineKeyboard
            .flatMap((kbRows: any) => kbRows)
            .find(({callback_data}: any) => callback_data === ctx.update.callback_query.data)

        if (buttonText !== undefined) {
            ctx.ua.e('Button', 'click', buttonText.text, undefined)
        }
        ctx.session.analytics.inlineClicks++
    }

    try {
        return await next()
    } catch (e) {
        if (ctx.ua !== undefined) {
            ctx.ua.exception(e.message, false)
        }
        throw e
    } finally {
        if (ctx.perf !== undefined && ctx.perf.timeBeforeFirstMsg !== undefined) {
            ctx.ua.timing('category', 'timeBeforeFirstMsg', Math.ceil(ctx.perf.timeBeforeFirstMsg))
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

const {i18SharedMsg} = i18nSceneHelper(new BaseScene<ContextMessageUpdate>(''))

export function analyticRecordEventView(ctx: ContextMessageUpdate, event: Event) {
    const label = `${i18SharedMsg(ctx, `category_icons.${event.category}`)} ${event.ext_id} ${event.title} [${event.place}]`
    ctx.ua.event('Card View', 'view', label, undefined)
    ctx.sessionTmp.analyticsScene.viewedEvents.push(+event.id)
}