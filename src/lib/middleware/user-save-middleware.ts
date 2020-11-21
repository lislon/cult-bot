import { ContextMessageUpdate } from '../../interfaces/app-interfaces'
import { db, IExtensions } from '../../db/db'
import { ITask } from 'pg-promise'

export const userSaveMiddleware = async (ctx: ContextMessageUpdate, next: any) => {
    await next()

    if (ctx.session.userId === undefined) {
        await db.tx(async (dbTx: ITask<IExtensions> & IExtensions) => {
            const user = await dbTx.userRepo.findUserByTid(ctx.from.id)
            if (user !== null) {
                ctx.session.userId = user.id
                ctx.session.uaUuid = user.ua_uuid;
            } else {
                const userId = await dbTx.userRepo.insertUser({
                    tid: ctx.message.from.id,
                    username: ctx.message.from.username,
                    first_name: ctx.message.from.first_name,
                    last_name: ctx.message.from.last_name,
                    language_code: ctx.message.from.language_code,
                    ua_uuid: ctx.session.uaUuid
                })
                ctx.session.userId = userId;
            }
        })
    }
}