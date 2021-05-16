import { ContextMessageUpdate } from '../../interfaces/app-interfaces'
import { formatUserName } from '../../util/misc-utils'
import { findInlineBtnTextByCallbackData, isAdmin } from '../../util/scene-helper'
import { logger } from '../../util/logger'
import * as Sentry from '@sentry/node'
import { MiddlewareFn } from 'telegraf'

function getTransactionName(ctx: ContextMessageUpdate): string {
    try {
        let txName: string | undefined = undefined
        if ('message' in ctx && ctx.message !== undefined && 'text' in ctx.message) {
            txName = ctx.message.text
        }

        if ('callback_query' in ctx.update && ctx.update.callback_query !== undefined) {
            if ('data' in ctx.update.callback_query) {
                const textQuery = findInlineBtnTextByCallbackData(ctx, ctx.update.callback_query.data)
                txName = textQuery ? `${textQuery} (${ctx.update.callback_query.data})` : ctx.update.callback_query.data
            }
        }
        return txName
    } catch (e) {
        logger.error(e)
        return 'error_getTransactionName'
    }
}

export function sentryMiddleware(): MiddlewareFn<ContextMessageUpdate> {
    return async (ctx: ContextMessageUpdate, next: () => Promise<void>): Promise<void> => {
        try {
            if ('from' in ctx && ctx.from !== undefined) {
                Sentry.setUser({
                    id: `${ctx.from.id}`,
                    username: formatUserName(ctx)
                })
            }
        } catch (e) {
            logger.error(e)
        }


        const transaction = Sentry.startTransaction({
            op: 'user.input',
            name: getTransactionName(ctx)
        })
        Sentry.addBreadcrumb({
            category: 'user.input',
            message: `User input '${getTransactionName(ctx)}'`
        })

        try {
            await next()
        } catch (e) {
            if (ctx.scene?.current?.id) {
                Sentry.setExtra('scene', ctx.scene.current?.id)
            }
            Sentry.setTag('is_admin', isAdmin(ctx))
            Sentry.captureException(e, transaction)
            throw e
        } finally {
            transaction.finish()
        }
    }
}
