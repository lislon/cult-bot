import { Composer, Scenes } from 'telegraf'
import { ContextMessageUpdate } from '../../interfaces/app-interfaces'
import { SceneRegister } from '../../middleware-utils'

const scene = new Scenes.BaseScene<ContextMessageUpdate>('location_scene')


function postStageActionsFn(bot: Composer<ContextMessageUpdate>): void {
    bot
        .on('location', async (ctx) => {
            await ctx.replyWithHTML(JSON.stringify(ctx.message.location, undefined, 2))
            await ctx.telegram.sendLocation(ctx.chat.id, 59.9311, 30.3609)
        })
}

export const locationScene: SceneRegister = {
    postStageActionsFn
}