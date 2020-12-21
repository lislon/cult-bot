import { Composer } from 'telegraf'
import { ContextMessageUpdate } from '../../interfaces/app-interfaces'
import { isAdmin } from '../../util/scene-helper'
import { SceneRegister } from '../../middleware-utils'
import { logger } from '../../util/logger'
import { i18n } from '../../util/i18n'
import { match } from 'telegraf-i18n'

const tail = new Composer<ContextMessageUpdate>()

const backButtonsCatch = new Composer<ContextMessageUpdate>()
i18n.resourceKeys('ru')
    .filter((id: string) => id.match(/^(shared|scenes[.][^.]+)[.]keyboard[.](back)$/))
    .forEach((id: string) => {
        backButtonsCatch.hears(match(id), async (ctx) => {
            logger.debug('main catch: %s', id)
            await ctx.scene.enter('main_scene');
        });
    })

tail
    .command('menu', async (ctx: ContextMessageUpdate) => {
        await ctx.scene.enter('main_scene');
    })
    .command('error', async (ctx: ContextMessageUpdate) => {
        throw new Error('This is test error from userId=' + ctx.from.id)
    })
    .command('me', async (ctx: ContextMessageUpdate) => {
        if (isAdmin(ctx)) {
            await ctx.replyWithHTML(JSON.stringify(ctx.session, undefined, 2))
        }
    })
    .on('sticker', (ctx) => ctx.reply('👍'))
    .hears('hi', (ctx) => ctx.reply('Hey there'))
    .hears(/.+/, async (ctx) => {
        await ctx.replyWithHTML('Введена непонятная команда. Вернемся вначало? /menu')
    })
    .use(backButtonsCatch)
    .action(/.+/, async (ctx) => {
        logger.debug('Аварийный выход');
        await ctx.answerCbQuery()
        await ctx.scene.enter('main_scene');
    })
    .hears(i18n.t(`ru`, `shared.keyboard.back`), async (ctx: ContextMessageUpdate) => {
        await ctx.scene.enter('main_scene');
    })
    .hears(/.+/, async (ctx, next) => {
        logger.info(`@${ctx.from.username} (id=${ctx.from.id}): [type=${ctx.updateType}], [text=${ctx.message.text}]`)

        return await next()
    })

function globalActionsFn(bot: Composer<ContextMessageUpdate>) {
    bot.use(tail)
}

export const tailScene = {
    scene: undefined,
    globalActionsFn
} as SceneRegister