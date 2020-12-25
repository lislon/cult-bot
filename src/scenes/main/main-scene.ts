import { BaseScene, Composer, Extra, Markup } from 'telegraf'
import { ContextMessageUpdate } from '../../interfaces/app-interfaces'
import { i18nSceneHelper, ifAdmin, isAdmin, sleep } from '../../util/scene-helper'
import middlewares, { SceneRegister } from '../../middleware-utils'
import { botConfig } from '../../util/bot-config'
import { db } from '../../database/db'
import { generatePlural, getNextWeekendRange } from '../shared/shared-logic'
import { logger } from '../../util/logger'

const scene = new BaseScene<ContextMessageUpdate>('main_scene');

const {i18nModuleBtnName, i18Btn, i18Msg} = i18nSceneHelper(scene)

const quick = botConfig.NODE_ENV === 'development' || botConfig.NODE_ENV === 'test'
export type MainSceneEnterState = { override_main_scene_msg?: string }

const content = (ctx: ContextMessageUpdate) => {
    const menu = [
        ['customize'],
        ['tops', 'packs'],
        ['search'],
        ...[(isAdmin(ctx) ? ['admin', 'feedback'] : ['feedback'])]
    ]

    const mainButtons = menu.map(row =>
        row.map(btnName => {
            return Markup.button(i18Btn(ctx, btnName));
        })
    );

    const state = ctx.scene.state as MainSceneEnterState
    return {
        msg: state.override_main_scene_msg ? state.override_main_scene_msg : i18Msg(ctx, 'select_anything'),
        markupMainMenu: Extra.HTML(true).markup(Markup.keyboard(mainButtons).resize())
    }
}

scene
    .enter(async (ctx: ContextMessageUpdate) => {
        const {msg, markupMainMenu} = content(ctx)

        await ctx.replyWithMarkdown(msg, markupMainMenu)

        ctx.ua.pv({dp: '/', dt: 'Главное меню'})
    })

function postStageActionsFn(bot: Composer<ContextMessageUpdate>) {
    bot
        .use(middlewares.logMiddleware('postStageActionsFn scene: ' + scene.id))
        .hears(i18nModuleBtnName('tops'), async (ctx: ContextMessageUpdate) => {
            await ctx.scene.enter('tops_scene')
        })
        .hears(/.{1,4}Подборки$/, async (ctx: ContextMessageUpdate) => {
            await ctx.scene.enter('packs_scene')
        })
        .hears(i18nModuleBtnName('search'), async (ctx: ContextMessageUpdate) => {
            await ctx.scene.enter('search_scene')
        })
        .hears(i18nModuleBtnName('customize'), async (ctx: ContextMessageUpdate) => {
            await ctx.scene.enter('customize_scene')
        })
        .hears(i18nModuleBtnName('feedback'), async (ctx: ContextMessageUpdate) => {
            await ctx.scene.enter('feedback_scene')
        })
        .hears(i18nModuleBtnName('admin'), async (ctx: ContextMessageUpdate) => {
            await ifAdmin(ctx, () => ctx.scene.enter('admin_scene'))
        });
}

function googleAnalyticsSource(ctx: ContextMessageUpdate & { startPayload: string }) {
    function getSourceTitle(sourceCode: string) {
        switch (sourceCode) {
            case 'i': return 'instagram'
            case 'f': return 'facebook'
            case 'v': return 'vk'
            case 't': return 'telegram'
            case 'o': return 'other'
            default:
                return sourceCode
        }
    }

    function getSourceFrom(sourceCode: string) {
        switch (sourceCode) {
            case '1': return 'igor'
            case '2': return 'elena'
            case '3': return 'anna'
            case '4': return 'masha'
            case 'L': return 'marina'
            default:
                return sourceCode
        }
    }

    if (ctx.startPayload !== '') {
        ctx.ua.set('cm', 'referral')

        let source = getSourceTitle(ctx.startPayload[0])

        if (ctx.startPayload.length > 1) {
            source += `-` + getSourceFrom(ctx.startPayload[1])
        }
        // vk-igor
        ctx.ua.set('cs', source)
    }
}

function preStageGlobalActionsFn(bot: Composer<ContextMessageUpdate>) {
    bot.start(async (ctx: ContextMessageUpdate & { startPayload: string }) => {
        logger.info([
            `/start`,
            `id=${ctx.from.id}`,
            `first_name=${ctx.from.first_name}`,
            `last_name=${ctx.from.last_name}`,
            `username=${ctx.from.username}`,
            `startPayload=${ctx.startPayload}`,
            `ua_uuid=${ctx.session.uaUuid}`].join(' '))

        // cn Campaign Name
        // cs
        const name = ctx.message.from.first_name
        if (!quick) await sleep(500)

        try {
            const count = await db.repoEventsCommon.countEvents({
                interval: getNextWeekendRange(ctx.now())
            })
            await ctx.replyWithHTML(ctx.i18n.t('root.welcome1', {
                name: name,
                eventPlural: generatePlural(ctx, 'event_prepositional', count)
            }))
        } catch (e) {
            logger.error(e)
        }
        if (!quick) await sleep(1000)

        // if (!quick) await sleep(1000)
        // await ctx.replyWithHTML(ctx.i18n.t('root.welcome4'), {disable_notification: true})

        googleAnalyticsSource(ctx)
        await ctx.scene.enter('main_scene', {override_main_scene_msg: ctx.i18n.t('root.welcome2')});
    })
}

export const mainScene = {
    scene,
    preStageGlobalActionsFn,
    postStageActionsFn
} as SceneRegister