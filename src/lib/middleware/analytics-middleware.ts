import { ContextMessageUpdate } from '../../interfaces/app-interfaces'
import ua from 'universal-analytics'
import { v4 as generateUuid } from 'uuid'
import { botConfig } from '../../util/bot-config'
import { bot } from '../../bot'
import { isAdmin } from '../../util/scene-helper'

export interface AnalyticsState {
    markupClicks: number
    inlineClicks: number
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
}

function shouldCountStatForUser(ctx: ContextMessageUpdate) {
    return botConfig.GOOGLE_ANALYTICS_COUNT_ADMINS === true || !isAdmin(ctx)
}

export const analyticsMiddleware = async (ctx: ContextMessageUpdate, next: any) => {
    if (ctx.session.uaUuid === undefined) {
        ctx.session.uaUuid = generateUuid()
    }
    ctx.ua = ua(botConfig.GOOGLE_ANALYTICS_ID, ctx.session.uaUuid);

    prepareSessionStateIfNeeded(ctx)
    if (ctx.updateType === 'message' && ctx.updateSubTypes.includes('text')) {
        ctx.ua.e('Event', 'button', ctx.message.text, undefined)
        ctx.session.analytics.markupClicks++
    }
    if (ctx.updateType === 'callback_query') {
        const message = ctx.update.callback_query.message as any
        const replyMarkup = message.reply_markup
        const inlineKeyboard = replyMarkup.inline_keyboard

        const buttonText = inlineKeyboard
            .flatMap((kbRows: any) => kbRows)
            .find(({ callback_data }: any) => callback_data === ctx.update.callback_query.data)

        if (buttonText !== undefined) {
            ctx.ua.e('Event', 'button', buttonText.text, undefined)
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
            ctx.ua.timing('bot', 'timeBeforeFirstMsg', ctx.perf.timeBeforeFirstMsg)
        }
        if (botConfig.GOOGLE_ANALYTICS_ID !== undefined) {

            if (shouldCountStatForUser(ctx)) {
                ctx.ua.send()
            }
        }
    }
}