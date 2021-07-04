import { logger } from './logger'
import { formatUserName } from './misc-utils'
import { ContextMessageUpdate } from '../interfaces/app-interfaces'
import * as Sentry from '@sentry/node'
import { isAdmin } from './scene-utils'

export function isBlockedError(error: any): boolean {
    return error?.code === 403 && error.message.includes('bot was blocked by the user')
}

export function isTooManyRequests(error: any): boolean {
    return error?.code === 429 && error.message.includes('Too Many Requests')
}

export const ERROR_MESSAGE_NOT_MODIFIED = '400: Bad Request: message is not modified: specified new message content and reply markup are exactly the same as a current content and reply markup of the message'

export async function botErrorHandler(error: any, ctx: ContextMessageUpdate): Promise<void> {
    try {
        if (error.message.includes('query is too old and response timeout expired')) {
            logger.debug(error.message)
            // ignore
        } else if (isTooManyRequests(error.message)) {
            logger.warn(`${formatUserName(ctx)}: ` + error.message)
            // ignore
        } else if (isBlockedError(error)) {
            logger.warn(`${formatUserName(ctx)}: blocked bot`)
            // ignore
        } else {
            logger.error(`Ooops, encountered an error for ${ctx.updateType}`, error)

            if (isAdmin(ctx)) {
                await ctx.replyWithHTML(ctx.i18n.t('root.something_went_wrong_admin', {
                    error: error.toString().substr(0, 4000),
                    time: (new Date()).toString(),
                    session: JSON.stringify(ctx.session || {}, undefined, 2).substring(0, 3500)
                }))
            } else {
                await ctx.replyWithHTML(ctx.i18n.t('root.something_went_wrong'))
            }
        }
    } catch (e) {
        if (e.message.includes('query is too old and response timeout expired')) {
            logger.debug(e.message)
            // ignore
        } else if (isTooManyRequests(e.message)) {
            logger.warn(`${formatUserName(ctx)}: ` + e.message)
            // ignore
        } else if (isBlockedError(e)) {
            logger.warn(`${formatUserName(ctx)}: blocked bot`)
            // ignore
        } else {
            logger.error(e)
        }
    }
}