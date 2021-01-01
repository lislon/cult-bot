import { logger } from './logger'
import { formatUserName } from './misc-utils'
import { isAdmin } from './scene-helper'
import { ContextMessageUpdate } from '../interfaces/app-interfaces'

export function isBlockedError(error: any) {
    return error?.code === 403 && error.message.includes('bot was blocked by the user')
}

export async function botErrorHandler(error: any, ctx: ContextMessageUpdate) {
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
                session: JSON.stringify(ctx.session, undefined, 2)
            }))
        } else {
            await ctx.replyWithHTML(ctx.i18n.t('root.something_went_wrong'))
        }
    }
}