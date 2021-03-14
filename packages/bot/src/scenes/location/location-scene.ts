import { Composer, Scenes } from 'telegraf'
import { ContextMessageUpdate } from '../../interfaces/app-interfaces'
import { SceneRegister } from '../../middleware-utils'

const scene = new Scenes.BaseScene<ContextMessageUpdate>('location_scene')


function postStageActionsFn(bot: Composer<ContextMessageUpdate>): void {
    bot
        .on('location', async (ctx) => {
            await ctx.replyWithHTML(JSON.stringify(ctx.message.location, undefined, 2))
        })
}

export const locationScene : SceneRegister = {
    postStageActionsFn
}