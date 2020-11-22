import { ContextMessageUpdate } from '../../interfaces/app-interfaces'
import { db, IExtensions } from '../../db/db'
import { ITask } from 'pg-promise'

const UPDATE_EVERY_N_SECONDS = 5 * 60

export interface UserSaveState {
    lastDbUpdated: number
}

function howManySecondsPassed(ctx: ContextMessageUpdate) {
    return (new Date().getTime() - ctx.session.userSave.lastDbUpdated) / 1000
}

const isTimeToRefreshDb = (ctx: ContextMessageUpdate) => ctx.session.userSave?.lastDbUpdated === undefined
    || howManySecondsPassed(ctx) > UPDATE_EVERY_N_SECONDS

export const userSaveMiddleware = async (ctx: ContextMessageUpdate, next: any) => {
    await next()

    if (ctx.session.userId === undefined || isTimeToRefreshDb(ctx)) {
        await db.tx(async (dbTx: ITask<IExtensions> & IExtensions) => {
            const user = await dbTx.userRepo.findUserByTid(ctx.from.id)
            if (user !== null) {
                ctx.session.userId = user.id
                ctx.session.uaUuid = user.ua_uuid

                await dbTx.userRepo.updateUser(user.id, {
                    chat_id: ctx.chat.id,
                    active_at: new Date()
                })
            } else {
                ctx.session.userId = await dbTx.userRepo.insertUser({
                    tid: ctx.message.from.id,
                    username: ctx.message.from.username,
                    first_name: ctx.message.from.first_name,
                    last_name: ctx.message.from.last_name,
                    language_code: ctx.message.from.language_code,
                    ua_uuid: ctx.session.uaUuid,
                    chat_id: ctx.chat.id
                })
            }
            ctx.session.userSave = {
                lastDbUpdated: new Date().getTime()
            }
        })
    }
}