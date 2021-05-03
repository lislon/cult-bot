import { Composer, Scenes } from 'telegraf'
import { ContextMessageUpdate } from '../../interfaces/app-interfaces'
import { i18nSceneHelper, isAdmin } from '../../util/scene-helper'
import { SceneRegister } from '../../middleware-utils'
import { getRedis } from '../../util/reddis'
import { formatISO, parseISO } from 'date-fns'
import { last, max, min, sortBy } from 'lodash'
import { ruFormat } from '../shared/shared-logic'
import { db } from '../../database/db'

const scene = new Scenes.BaseScene<ContextMessageUpdate>('main_scene')

const {i18nModuleBtnName, i18Btn, i18Msg} = i18nSceneHelper(scene)

const REDIS_PREFIX = `promo:collectqr`
const EXPIRE_SECONDS = 20 * 24 * 3600

interface StatItem {
    start: string
    date: string
}

interface Participant {
    userName: string
    startDate: Date
    endDate: Date
    starts: string[]
}

function preStageGlobalActionsFn(bot: Composer<ContextMessageUpdate>): void {
    bot.start(async (ctx: ContextMessageUpdate & { startPayload: string }, next: () => Promise<void>) => {
        if (ctx.startPayload !== '') {
            const key = `${REDIS_PREFIX}:${ctx.session.user.id}`
            const statItem: StatItem = {
                start: ctx.startPayload,
                date: formatISO(ctx.now())
            }
            await getRedis().rpush(key, JSON.stringify(statItem))
            await getRedis().expire(key, EXPIRE_SECONDS)
        }
        await next()
    })
    bot.command('/collectqr', async ctx => {
        if (isAdmin(ctx)) {
            const cleanCmd = ctx.message.text.replace('/collectqr', '').trim()
            const requiredStarts = cleanCmd === '' ? undefined : cleanCmd.split(/\s+|\s*,\s*/).map(s => s.toLowerCase());

            const participants: Participant[] = []
            const keys = await getRedis().keys(`${REDIS_PREFIX}:*`)
            for (const key of keys) {
                const rawJsons = await getRedis().lrange(key, 0, -1)
                const userId = +last(key.split(':'))
                const startsRaw = rawJsons
                    .map(rawJson => JSON.parse(rawJson) as StatItem)

                if (requiredStarts !== undefined) {
                    const startsVisitedByUser = startsRaw.map(s => s.start.toLowerCase())
                    if (!requiredStarts.every(s => startsVisitedByUser.includes(s))) {
                        continue;
                    }
                }

                const foundRequiredStarts = requiredStarts !== undefined ? startsRaw.filter(s => requiredStarts.includes(s.start)) : startsRaw

                const user = await db.repoUser.findUserById(userId)
                const userName = user ? `id=${user.id} ${user.username || ''} ${user.first_name || ''}${user.last_name || ''}`.trim() : `id=${userId}`

                participants.push({
                    userName,
                    startDate: parseISO(min(foundRequiredStarts.map(s => s.date))),
                    endDate: parseISO(max(foundRequiredStarts.map(s => s.date))),
                    starts: startsRaw.map(s => s.start)
                })
            }
            const sorted = sortBy(participants, 'endDate')
            const rows = sorted.map((s, counter) => [
                `${counter + 1}. <b>${s.userName}</b>`,
                `  Последний QR: <b>${ruFormat(s.endDate, 'dd MMMM HH:mm:ss')}</b>`,
                `  Первый QR: ${ruFormat(s.startDate, 'dd MMMM HH:mm:ss')}`,
                `  Набор: ${s.starts.join(' → ')}`].join('\n') + '\n')

            const s = `Показываем всех юзеров, кто собрал ссылки: ${requiredStarts ? requiredStarts.join(' + ') : ' любые ссылки'}\n`

            await ctx.replyWithHTML(s + rows.join('\n'))
        }
    })
}

export const promoCollectQrScene: SceneRegister = {
    preStageGlobalActionsFn
}