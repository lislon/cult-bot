import { ContextMessageUpdate } from '../../interfaces/app-interfaces'
import { db } from '../../database/db'
import { countInteractions } from './analytics-middleware'
import { botConfig } from '../../util/bot-config'
import { isBlockedError } from '../../util/error-handler'

const UPDATE_EVERY_N_SECONDS = 1 * 30

export interface UserState {
    id: number
    lastDbUpdated: number
    uaUuid?: string
    eventsFavorite: number[]
    version: string
    clicks: number
    showTags: boolean
}

export interface UserStateTmp {
    firstTimeUser: boolean
}

function howManySecondsPassed(ctx: ContextMessageUpdate) {
    return (new Date().getTime() - ctx.session.user.lastDbUpdated) / 1000
}

const isTimeToRefreshDb = (ctx: ContextMessageUpdate) => ctx.session.user?.lastDbUpdated === undefined
    || howManySecondsPassed(ctx) > UPDATE_EVERY_N_SECONDS

async function prepareSessionIfNeeded(ctx: ContextMessageUpdate) {
    if (ctx.session.user === undefined) {
        ctx.session.user = {
            lastDbUpdated: 0,
            clicks: 0,
            version: botConfig.HEROKU_RELEASE_VERSION || '',
            id: 0,
            uaUuid: undefined,
            showTags: false,
            eventsFavorite: []
        }
    }

    if (ctx.session.user.id === 0 && ctx.from) {
        const userDb = await db.repoUser.findUserByTid(ctx.from.id)
        if (userDb) {
            ctx.session.user = {
                ...ctx.session.user,
                id: userDb.id,
                uaUuid: userDb.ua_uuid,
                clicks: userDb.clicks || 0,
                eventsFavorite: userDb.events_favorite.map(e => +e),
            }
        } else {
            ctx.session.user.id = await doInsertUser(ctx)
            ctx.sessionTmp.userScene = {
                firstTimeUser: true
            }
        }
    }

}

export function forceSaveUserDataInDb(ctx: ContextMessageUpdate): void {
    ctx.session.user.lastDbUpdated = 0
}

async function doInsertUser(ctx: ContextMessageUpdate, uaUuid = '00000000-0000-0000-0000-000000000000'): Promise<number> {
    return await db.repoUser.insertUser({
        tid: ctx.from.id,
        username: ctx.from.username,
        first_name: ctx.from.first_name,
        last_name: ctx.from.last_name,
        language_code: ctx.from.language_code,
        ua_uuid: uaUuid
    })
}

export async function updateOrInsertUser(ctx: ContextMessageUpdate, blockedAt: Date = undefined): Promise<void> {
    if (ctx.sessionTmp.userScene?.firstTimeUser) {
        await db.repoUser.updateUser(ctx.session.user.id, {
            active_at: new Date(),
            blocked_at: blockedAt,
            clicks: countInteractions(ctx),
            ua_uuid: ctx.session.user.uaUuid,
            referral: ctx.sessionTmp.analyticsScene?.referral
        })

        ctx.session.user.lastDbUpdated = new Date().getTime()
    } else if ((isTimeToRefreshDb(ctx) || blockedAt !== undefined) && ctx.session.user.id !== 0) {
        const wasUserUpdated = await db.repoUser.updateUser(ctx.session.user.id, {
            active_at: new Date(),
            blocked_at: blockedAt,
            events_favorite: ctx.session.user.eventsFavorite,
            clicks: countInteractions(ctx)
        })
        if (!wasUserUpdated) {
            ctx.session.user.id = await doInsertUser(ctx, ctx.session.user.uaUuid)
        }
        ctx.session.user.clicks = countInteractions(ctx)
        ctx.session.user.lastDbUpdated = new Date().getTime()
    }
}

export const userMiddleware = async (ctx: ContextMessageUpdate, next: () => Promise<void>) => {
    await prepareSessionIfNeeded(ctx)

    try {
        await next()
    } catch (e) {
        if (isBlockedError(e)) {
            await updateOrInsertUser(ctx, new Date())
        }
        throw e
    }

    await updateOrInsertUser(ctx)
}