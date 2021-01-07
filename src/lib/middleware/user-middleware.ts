import { ContextMessageUpdate } from '../../interfaces/app-interfaces'
import { db } from '../../database/db'
import { countInteractions } from './analytics-middleware'

const UPDATE_EVERY_N_SECONDS = 5 * 60

export interface UserState {
    id: number
    lastDbUpdated: number
    uaUuid?: string
    eventsFavorite: number[]
}


function howManySecondsPassed(ctx: ContextMessageUpdate) {
    return (new Date().getTime() - ctx.session.user.lastDbUpdated) / 1000
}

const isTimeToRefreshDb = (ctx: ContextMessageUpdate) => ctx.session.user?.lastDbUpdated === undefined
    || howManySecondsPassed(ctx) > UPDATE_EVERY_N_SECONDS

function migrateOldSession(ctx: ContextMessageUpdate) {
    const anySession = ctx.session as any

    if (anySession.userId !== undefined) {
        ctx.session.user.id = anySession.userId
    }

    if (anySession.uaUuid !== undefined) {
        ctx.session.user.uaUuid = anySession.uaUuid
    }

    delete anySession.mainScene?.gcMessages
    delete anySession.userId
    delete anySession.uaUuid
}


async function prepareSessionIfNeeded(ctx: ContextMessageUpdate) {
    if (ctx.session.user === undefined) {
        ctx.session.user = {
            lastDbUpdated: 0,
            id: 0,
            uaUuid: undefined,
            eventsFavorite: []
        }
    }
    migrateOldSession(ctx)

    if (ctx.session.user.id === 0) {
        const userDb = await db.repoUser.findUserByTid(ctx.from.id)
        if (userDb) {
            ctx.session.user = {
                ...ctx.session.user,
                id: userDb.id,
                uaUuid: userDb.ua_uuid,
                eventsFavorite: userDb.events_favorite.map(e => +e)
            }
        }
    }

}

export function forceSaveUserDataInDb(ctx: ContextMessageUpdate) {
    ctx.session.user.lastDbUpdated = 0
}

async function updateOrInsertUser(ctx: ContextMessageUpdate) {
    if (ctx.session.user.id === 0) {
        ctx.session.user.id = await db.repoUser.insertUser({
            tid: ctx.from.id,
            username: ctx.from.username,
            first_name: ctx.from.first_name,
            last_name: ctx.from.last_name,
            language_code: ctx.from.language_code,
            ua_uuid: ctx.session.user.uaUuid
        })
        ctx.session.user.lastDbUpdated = new Date().getTime()
    } else if (isTimeToRefreshDb(ctx)) {
        await db.repoUser.updateUser(ctx.session.user.id, {
            active_at: new Date(),
            blocked_at: undefined,
            events_favorite: ctx.session.user.eventsFavorite,
            clicks: countInteractions(ctx)
        })
    }
}

export const userMiddleware = async (ctx: ContextMessageUpdate, next: any) => {
    await prepareSessionIfNeeded(ctx)

    await next()

    await updateOrInsertUser(ctx)
}