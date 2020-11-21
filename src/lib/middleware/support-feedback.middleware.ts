import { ContextMessageUpdate } from '../../interfaces/app-interfaces'
import { Composer } from 'telegraf'
import { db } from '../../db/db'

export const supportFeedbackMiddleware = new Composer<ContextMessageUpdate>()

supportFeedbackMiddleware.hears(/.+/, async (ctx: ContextMessageUpdate, next: any) => {
    console.log(`support chat: (id=${ctx.chat.id}) ${ctx.message.text}`)
    await next()
})

supportFeedbackMiddleware.command('stat', async (ctx: ContextMessageUpdate, next: any) => {
    await ctx.replyWithHTML(await db.repoFeedback.getQuizStats())
    await next()
})