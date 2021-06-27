import { Composer, Scenes } from 'telegraf'
import { ContextMessageUpdate } from '../../interfaces/app-interfaces'
import { i18nSceneHelper } from '../../util/scene-helper'
import { db } from '../../database/db'
import { SceneRegister } from '../../middleware-utils'
import { formatUserName } from '../../util/misc-utils'
import { updateLikeDislikeInlineButtons } from './likes-common'

const scene = new Scenes.BaseScene<ContextMessageUpdate>('likes_scene')

const {i18Msg} = i18nSceneHelper(scene)

function logLikes(plusLikes: number, ctx: ContextMessageUpdate, eventId: number, plusDislikes: number) {
    if (plusLikes > 0) {
        ctx.logger.debug(formatUserName(ctx) + ' liked eventId=' + eventId)
    } else if (plusDislikes > 0) {
        ctx.logger.debug(formatUserName(ctx) + ' disliked eventId=' + eventId)
    } else {
        ctx.logger.debug(formatUserName(ctx) + ' reverted like/dislike eventId=' + eventId)
    }
}

function postStageActionsFn(bot: Composer<ContextMessageUpdate>): void {
    bot
        .action(/^like_(\d+)/, async ctx => {
            const eventId = +ctx.match[1]

            await db.task(async dbTask => {
                const {plusLikes, plusDislikes} = await dbTask.repoEventsCommon.voteEvent(ctx.session.user.id, eventId, 'like')

                logLikes(plusLikes, ctx, eventId, plusDislikes)
                const [{title}] = await dbTask.repoEventsCommon.getEventsByIds([eventId])
                await ctx.answerCbQuery(i18Msg(ctx, plusLikes > 0 ? `cb_answer_liked` : `cb_answer_unliked`, {title}))
                await updateLikeDislikeInlineButtons(ctx, dbTask, eventId)
            })
        })
        .action(/^dislike_(\d+)/, async ctx => {
            const eventId = +ctx.match[1]
            await db.task(async dbTask => {
                const {plusLikes, plusDislikes} = await dbTask.repoEventsCommon.voteEvent(ctx.session.user.id, eventId, 'dislike')

                logLikes(plusLikes, ctx, eventId, plusDislikes)
                const [{title}] = await dbTask.repoEventsCommon.getEventsByIds([eventId])
                await ctx.answerCbQuery(i18Msg(ctx, plusDislikes > 0 ? `cb_answer_disliked` : `cb_answer_undisliked`, {title}))
                await updateLikeDislikeInlineButtons(ctx, dbTask, eventId)
            })
        })
}

export const likesScene: SceneRegister = {
    postStageActionsFn
}
