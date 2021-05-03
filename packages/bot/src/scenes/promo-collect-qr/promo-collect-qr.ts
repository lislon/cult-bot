import { Composer, Scenes } from 'telegraf'
import { ContextMessageUpdate } from '../../interfaces/app-interfaces'
import { i18nSceneHelper, isAdmin } from '../../util/scene-helper'
import { getRedis } from '../../util/reddis'
import { db } from '../../database/db'
import { logger } from '../../util/logger'
import { SceneRegister } from '../../middleware-utils'

const scene = new Scenes.BaseScene<ContextMessageUpdate>('main_scene')

const {i18nModuleBtnName, i18Btn, i18Msg} = i18nSceneHelper(scene)

const REDIS_PREFIX = 'promo:collectqr'
const EXPIRE_SECONDS = 20 * 24 * 3600

interface QRCodeStat {
    qr: string
    userNames: string[]
}

function preStageGlobalActionsFn(bot: Composer<ContextMessageUpdate>): void {
    bot.start(async (ctx: ContextMessageUpdate & { startPayload: string }, next: () => Promise<void>) => {
        try {
            if (ctx.startPayload !== '') {
                const key = `${REDIS_PREFIX}:${ctx.startPayload}`
                await getRedis().rpush(key, `${ctx.session.user.id}`)
                await getRedis().expire(key, EXPIRE_SECONDS)
            }
        } catch (e) {
            logger.error(e)
        }
        await next()
    })
    bot.command('/qr', async ctx => {
        if (isAdmin(ctx)) {
            const cleanCmd = ctx.message.text.replace('/qr', '').trim()
            if (cleanCmd === '') {
                await ctx.replyWithHTML('Invalid format.\nTry: /qr a1,a2,a3')
                return
            }
            const requestedQRs = cleanCmd.split(/\s+|\s*,\s*/);

            const stats: QRCodeStat[] = []

            for (const qr of requestedQRs) {
                const userIds = await getRedis().lrange(`${REDIS_PREFIX}:${qr}`, 0, -1)

                const userNames = []
                for (const userId of userIds) {
                    const user = await db.repoUser.findUserById(+userId)
                    userNames.push(user ? `id=${user.id} ${user.username ? `username=${user.username}` : ''} ${user.first_name || ''} ${user.last_name || ''}`.trim() : `id=${userId}`)
                }

                stats.push({
                    qr, userNames
                });
            }


            const rows = stats.map(({qr, userNames }) => {
                return [`<b>${qr}</b> - ${userNames.length} пользователей`, ... (userNames.sort().map(u => ` ${u}`)) ].join('\n') + '\n'
            })

            await ctx.replyWithHTML(`Статистика по QR кодам ${requestedQRs.join(',')}:\n\n` + rows.join('\n'))
        }
    })
}

export const promoCollectQrScene: SceneRegister = {
    preStageGlobalActionsFn
}