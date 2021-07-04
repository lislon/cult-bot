import { Composer } from 'telegraf'
import { ContextMessageUpdate } from '../../interfaces/app-interfaces'
import { SceneRegister } from '../../middleware-utils'
import { backToMainButtonTitle, buttonIsOldGoToMain } from '../shared/shared-logic'
import { isAdmin } from '../../util/scene-utils'

const tail = new Composer<ContextMessageUpdate>()

const backButtonsCatch = new Composer<ContextMessageUpdate>()
backButtonsCatch
    .hears(backToMainButtonTitle().trim(), async ctx => {
        await ctx.scene.enter('main_scene')
    })
    // eslint-disable-next-line no-misleading-character-class
    .hears(/^\s*[◀️ ]/, async ctx => {
        ctx.logger.debug('main catch: %s', ctx.match[0])
        await ctx.scene.enter('main_scene')
    })
    .hears(/(\s|^)Назад(\s|$)|◀️/, async ctx => {
        ctx.logger.debug('main catch: %s', ctx.match[0])
        await ctx.scene.enter('main_scene')
    })
    .action(/[.]back$/, async (ctx) => {
        await ctx.answerCbQuery()
        await ctx.scene.enter('main_scene')
    })
// i18n.resourceKeys('ru')
//     .filter((id: string) => id.match(/^(shared|scenes[.][^.]+)[.]keyboard[.](back)$/))
//     .forEach((id: string) => {
//         backButtonsCatch.hears(match(id), async (ctx) => {
//             ctx.logger.debug('main catch: %s', id)
//             await ctx.scene.enter('main_scene');
//         });
//     })

tail
    .command('menu', async ctx => {
        await ctx.scene.enter('main_scene')
    })
    .command('error', async ctx => {
        throw new Error('This is test error from userId=' + ctx.from.id)
    })
    .command('me', async ctx => {
        if (isAdmin(ctx)) {
            await ctx.replyWithHTML(JSON.stringify(ctx.session, undefined, 2))
        }
    })
    .on('sticker', (ctx) => ctx.reply('👍'))
    .hears('hi', (ctx) => ctx.reply('Hey there'))
    .use(backButtonsCatch)
    .hears(/.+/, async (ctx) => {
        await ctx.replyWithHTML(ctx.i18n.t('root.bad_text'))
        ctx.logger.warn(`@${ctx.from.username} (id=${ctx.from.id}): [text=${ctx.message.text}] Введена непонятная команда`)
    })
    .action('go_to_main', async (ctx) => {
        await ctx.scene.enter('main_scene')
    })
    .action(/.+/, async (ctx) => {
        await ctx.answerCbQuery()
        await buttonIsOldGoToMain(ctx)
        if ('data' in ctx.update?.callback_query) {
            ctx.logger.warn(`@${ctx.from?.username} (id=${ctx.from?.id}): [type=${ctx.updateType}], [callback_data=${ctx.update.callback_query.data}] Аварийный выход`)
        }
    })

function postStageActionsFn(bot: Composer<ContextMessageUpdate>): void {
    bot.use(tail)
}

export const tailScene: SceneRegister = {
    scene: undefined,
    postStageActionsFn
}