import { BaseScene, Composer } from 'telegraf'
import { ContextMessageUpdate } from '../../interfaces/app-interfaces'
import { i18nSceneHelper } from '../../util/scene-helper'
import { db, IExtensions } from '../../database/db'
import { InlineKeyboardButton, InlineKeyboardMarkup } from 'telegram-typings'
import { SceneRegister } from '../../middleware-utils'
import { ITask } from 'pg-promise'
import { logger } from '../../util/logger'
import { formatUserName } from '../../util/misc-utils'

const scene = new BaseScene<ContextMessageUpdate>('likes_scene');

const {i18nModuleBtnName, i18Btn, i18Msg, i18SharedBtn} = i18nSceneHelper(scene)

async function parseAndUpdateBtn(replyMarkup: InlineKeyboardMarkup, callbackDataToken: RegExp, updateFunc: (text: InlineKeyboardButton) => (InlineKeyboardButton)): Promise<undefined | InlineKeyboardMarkup> {
    if (replyMarkup !== undefined) {
        const newKeyboard: InlineKeyboardButton[][] = []
        for (const row of replyMarkup.inline_keyboard) {
            newKeyboard.push(
                row.map(btn => {
                    if (btn.callback_data.match(callbackDataToken)) {
                        return updateFunc(btn)
                    }
                    return btn;
                }))
        }
        return {inline_keyboard: newKeyboard}
    }
    return undefined
}

async function updateLikeDislikeInlineButtons(ctx: ContextMessageUpdate, dbTask: ITask<IExtensions> & IExtensions, eventId: number, plusLikes: number, plusDislikes: number) {
    const keyboard = (ctx.update.callback_query.message as any)?.reply_markup as InlineKeyboardMarkup

    const [likes, dislikes] = await dbTask.repoEventsCommon.getLikesDislikes(eventId)

    const newKeyboard = await parseAndUpdateBtn(keyboard, /^(like|dislike)_/, (btn) => {
        if (btn.callback_data.startsWith('like_')) {
            return {...btn, text: i18Btn(ctx, 'like', {count: likes})}
        } else {
            return {...btn, text: i18Btn(ctx, 'dislike', {count: dislikes})}
        }
    })
    if (JSON.stringify(newKeyboard) !== JSON.stringify(keyboard)) {
        await ctx.editMessageReplyMarkup(newKeyboard)
    }
}

function logLikes(plusLikes: number, ctx: ContextMessageUpdate, eventId: number, plusDislikes: number) {
    if (plusLikes > 0) {
        logger.info(formatUserName(ctx) + ' liked ' + eventId)
    } else if (plusDislikes > 0) {
        logger.info(formatUserName(ctx) + ' disliked' + eventId)
    } else {
        logger.info(formatUserName(ctx) + ' reverted like/dislike' + eventId)
    }
}

function postStageActionsFn(bot: Composer<ContextMessageUpdate>) {
    bot
        .action(/^like_(\d+)/, async (ctx: ContextMessageUpdate) => {
            const eventId = +ctx.match[1]

            await db.task(async dbTask => {
                const {plusLikes, plusDislikes} = await dbTask.repoEventsCommon.voteEvent(ctx.session.userId, eventId, 'like')

                logLikes(plusLikes, ctx, eventId, plusDislikes)

                await ctx.answerCbQuery(i18Msg(ctx, plusLikes > 0 ? `cb_answer_liked` : `cb_answer_unliked`))
                await updateLikeDislikeInlineButtons(ctx, dbTask, eventId, plusLikes, plusDislikes)
            })
        })
        .action(/^dislike_(\d+)/, async (ctx: ContextMessageUpdate) => {
            const eventId = +ctx.match[1]
            await db.task(async dbTask => {
                const {plusLikes, plusDislikes} = await dbTask.repoEventsCommon.voteEvent(ctx.session.userId, eventId, 'dislike')

                logLikes(plusLikes, ctx, eventId, plusDislikes)

                await ctx.answerCbQuery(i18Msg(ctx, plusDislikes > 0 ? `cb_answer_disliked` : `cb_answer_undisliked`))
                await updateLikeDislikeInlineButtons(ctx, dbTask, eventId, plusLikes, plusDislikes)
            })
        })
        .action(/^favorite_(\d+)/, async (ctx: ContextMessageUpdate) => {
            await ctx.answerCbQuery('😹 Это кнопка-декорация, она не настоящая')
        })
}

export const likesScene = {
    postStageActionsFn
} as SceneRegister
