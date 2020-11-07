import { ContextMessageUpdate } from '../../interfaces/app-interfaces'
import { db, IExtensions } from '../../db'
import { ITask } from 'pg-promise'

export const userSaveMiddleware = async (ctx: ContextMessageUpdate, next: any) => {
    await next()

    if (ctx.session.id === undefined) {
        await db.tx(async (dbTx: ITask<IExtensions> & IExtensions) => {
            const user = await dbTx.userRepo.findUserByTid(ctx.from.id)
            if (user !== undefined) {
                ctx.session.id = user.id
                ctx.session.uaUuid = user.ua_uuid;
            } else {
                const id = await dbTx.userRepo.insertUser({
                    tid: ctx.message.from.id,
                    username: ctx.message.from.username,
                    first_name: ctx.message.from.first_name,
                    last_name: ctx.message.from.last_name,
                    language_code: ctx.message.from.language_code,
                    ua_uuid: ctx.session.uaUuid
                })
                ctx.session.id = id;
            }
        })
    }
}