import { Composer, Markup, Scenes } from 'telegraf'
import { ContextMessageUpdate } from '../../interfaces/app-interfaces'
import { SceneRegister } from '../../middleware-utils'
import { replyWithBackToMainMarkup, ruFormat } from '../shared/shared-logic'
import { botConfig } from '../../util/bot-config'
import { db } from '../../database/db'
import { isPaidUser } from '../../util/scene-utils'
import { i18nSceneHelper } from '../../util/scene-helper'

const scene = new Scenes.BaseScene<ContextMessageUpdate>('lk_scene')

const {i18nModuleBtnName, i18Btn, i18Msg} = i18nSceneHelper(scene)

async function formatPayments(ctx: ContextMessageUpdate): Promise<string> {
    const payments = await db.repoBilling.listAllPayments({
        userId: ctx.session.user.id
    })

    if (payments.length === 0) {
        return 'нет оплаченых счетов'
    } else {
        return payments
            .filter(p => p.paidAt !== undefined)
            .map(p => ` - <b>${p.amount} руб</b> оплачено ${ruFormat(p.paidAt, 'dd MMMM HH:mm:ss')} (Счет #${p.id})`)
            .join('\n')
    }
}

scene
    .enter(async ctx => {

        await replyWithBackToMainMarkup(ctx, i18Msg(ctx, 'markup_back_decoy'))

        // const {msg, markupMainMenu} = content(ctx)
        const markupWithBackButton = Markup.inlineKeyboard([
            [Markup.button.url(i18Btn(ctx, 'buy_subscription_a'), `${botConfig.SITE_URL}/pay/${ctx.session.user.id}:100`)]
        ])

        if (isPaidUser(ctx)) {
            await ctx.replyWithHTML(i18Msg(ctx, 'welcome_paid', {
                dateEnd: ruFormat(new Date(2025, 1, 1), 'dd MMMM')
            }), markupWithBackButton)
        } else {
            await ctx.replyWithHTML(i18Msg(ctx, 'welcome_guest', {
                payments: await formatPayments(ctx)
            }), markupWithBackButton)
        }
    })

function postStageActionsFn(bot: Composer<ContextMessageUpdate>): void {
    bot
        .command(['/pay', '/buy'], async ctx => {
            ctx.session.user.isPaid = true
            await ctx.replyWithHTML('Congrats! You are now paid user! /sell cancel')
        })
        .command('/sell', async ctx => {
            ctx.session.user.isPaid = false
            await ctx.replyWithHTML('You are now guest! /buy to buy')
        })
}

export const lkScene: SceneRegister = {
    scene,
    postStageActionsFn
}