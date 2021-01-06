import { BaseScene, Composer } from 'telegraf'
import { ContextMessageUpdate } from '../../interfaces/app-interfaces'
import { i18nSceneHelper } from '../../util/scene-helper'
import { db } from '../../database/db'
import { SceneRegister } from '../../middleware-utils'
import { logger } from '../../util/logger'
import { formatUserName } from '../../util/misc-utils'
import { updateLikeDislikeInlineButtons } from './likes-common'

const scene = new BaseScene<ContextMessageUpdate>('likes_scene');

const {i18nModuleBtnName, i18Btn, i18Msg, i18SharedBtn} = i18nSceneHelper(scene)

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
                const {plusLikes, plusDislikes} = await dbTask.repoEventsCommon.voteEvent(ctx.session.user.id, eventId, 'like')

                logLikes(plusLikes, ctx, eventId, plusDislikes)

                await ctx.answerCbQuery(i18Msg(ctx, plusLikes > 0 ? `cb_answer_liked` : `cb_answer_unliked`))
                await updateLikeDislikeInlineButtons(ctx, dbTask, eventId)
            })
        })
        .action(/^dislike_(\d+)/, async (ctx: ContextMessageUpdate) => {
            const eventId = +ctx.match[1]
            await db.task(async dbTask => {
                const {plusLikes, plusDislikes} = await dbTask.repoEventsCommon.voteEvent(ctx.session.user.id, eventId, 'dislike')

                logLikes(plusLikes, ctx, eventId, plusDislikes)

                await ctx.answerCbQuery(i18Msg(ctx, plusDislikes > 0 ? `cb_answer_disliked` : `cb_answer_undisliked`))
                await updateLikeDislikeInlineButtons(ctx, dbTask, eventId)
            })
        })
}

export const likesScene = {
    postStageActionsFn
} as SceneRegister
