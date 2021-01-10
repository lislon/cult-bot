import { logger } from './logger'
import { formatUserName } from './misc-utils'
import { isAdmin } from './scene-helper'
import { ContextMessageUpdate } from '../interfaces/app-interfaces'

export function isBlockedError(error: any) {
    return error?.code === 403 && error.message.includes('bot was blocked by the user')
}

export const ERROR_MESSAGE_NOT_MODIFIED = '400: Bad Request: message is not modified: specified new message content and reply markup are exactly the same as a current content and reply markup of the message'

export async function botErrorHandler(error: any, ctx: ContextMessageUpdate) {
    try {
        if (error.message.includes('query is too old and response timeout expired')) {
            logger.debug(error.message)
            // ignore
        } else if (isBlockedError(error)) {
            logger.debug(`${formatUserName(ctx)}: blocked bot`)
            // ignore
        } else {
            logger.error(`Ooops, encountered an error for ${ctx.updateType}`, error)


            if (isAdmin(ctx)) {
                await ctx.replyWithHTML(ctx.i18n.t('root.something_went_wrong_admin', {
                    error: error.toString().substr(0, 4000),
                    time: (new Date()).toString(),
                    session: JSON.stringify(ctx.session, undefined, 2).substring(0, 3500)
                }))
            } else {
                await ctx.replyWithHTML(ctx.i18n.t('root.something_went_wrong'))
            }
        }
    } catch (e) {
        logger.error(e)
    }
}