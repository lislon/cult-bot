import { Composer, Markup, Scenes } from 'telegraf'
import { ContextMessageUpdate } from '../../interfaces/app-interfaces'
import { i18nSceneHelper, ifAdmin, isAdmin, sleep } from '../../util/scene-helper'
import { SceneRegister } from '../../middleware-utils'
import { botConfig } from '../../util/bot-config'
import { db } from '../../database/db'
import {
    extraInlineMenu,
    generatePlural,
    getInlineKeyboardFromCallbackQuery,
    getNextWeekendRange,
    isEventInFuture,
    mySlugify,
    updateKeyboardButtons
} from '../shared/shared-logic'
import { getLikesRow } from '../likes/likes-common'
import { cardFormat } from '../shared/card-format'
import { User } from 'typegram/manage'
import { analyticRecordEventView, analyticRecordReferral } from '../../lib/middleware/analytics-middleware'
import { parseAndPredictTimetable } from '../../lib/timetable/timetable-utils'

const scene = new Scenes.BaseScene<ContextMessageUpdate>('main_scene')

const {i18nModuleBtnName, i18Btn, i18Msg} = i18nSceneHelper(scene)

const quick = botConfig.NODE_ENV === 'test'
export type MainSceneEnterState = { override_main_scene_msg?: string }

const content = (ctx: ContextMessageUpdate) => {
    const menu = [
        ['customize'],
        ['tops', 'packs'],
        ...[(isAdmin(ctx) ? ['search', 'admin'] : ['search'])],
        ['feedback', 'favorites'],
    ]

    const mainButtons = menu.map(row =>
        row.map(btnName => {
            return Markup.button.text(i18Btn(ctx, btnName))
        })
    );

    const state = ctx.scene.state as MainSceneEnterState
    return {
        msg: state.override_main_scene_msg ? state.override_main_scene_msg : i18Msg(ctx, 'select_anything'),
        markupMainMenu: Markup.keyboard(mainButtons).resize()
    }
}

scene
    .enter(async ctx => {
        const {msg, markupMainMenu} = content(ctx)

        await ctx.replyWithHTML(msg, markupMainMenu)

        ctx.ua.pv({dp: '/', dt: 'Главное меню'})
    })

function postStageActionsFn(bot: Composer<ContextMessageUpdate>) {
    bot
        // .use(middlewares.logMiddleware('postStageActionsFn scene: ' + scene.id))
        .hears(i18nModuleBtnName('tops'), async ctx => {
            await ctx.scene.enter('tops_scene')
        })
        .hears(/.{1,4}Подборки$/, async ctx => {
            await ctx.scene.enter('packs_scene')
        })
        .hears(i18nModuleBtnName('search'), async ctx => {
            await ctx.scene.enter('search_scene')
        })
        .hears(i18nModuleBtnName('customize'), async ctx => {
            await ctx.scene.enter('customize_scene')
        })
        .hears(i18nModuleBtnName('feedback'), async ctx => {
            await ctx.scene.enter('feedback_scene')
        })
        .hears(i18nModuleBtnName('favorites'), async ctx => {
            await ctx.scene.enter('favorites_scene')
        })
        .hears(i18nModuleBtnName('admin'), async ctx => {
            await ifAdmin(ctx, () => ctx.scene.enter('admin_scene'))
        })
        .action('back_as_new', async ctx => {
            await ctx.answerCbQuery()
            const keyboardWithoutBackButton = await updateKeyboardButtons(getInlineKeyboardFromCallbackQuery(ctx), /back_as_new/, () => {
                return undefined
            })

            try {
                await ctx.editMessageReplyMarkup(Markup.inlineKeyboard(keyboardWithoutBackButton.inline_keyboard).reply_markup)
            } catch (e) {
                ctx.logger.warn('error when click on on start button: ', e)
            }
            await showWelcomeScene(ctx, ctx.callbackQuery)
        })
}

function setGoogleAnalyticsSource(ctx: ContextMessageUpdate, payloads: string[]) {

    function getSourceTitle(sourceCode: string) {
        switch (sourceCode) {
            case 'a':
                return 'advert'
            case 'i':
                return 'instagram'
            case 'f':
                return 'facebook'
            case 'v':
                return 'vk'
            case 't':
                return 'telegram'
            case 'o':
                return 'other'
            case 'm':
                return 'email'
            default:
                return sourceCode
        }
    }

    function getSourceFrom(sourceCode: string) {
        switch (sourceCode) {
            case '1':
                return 'igor'
            case '2':
                return 'elena'
            case '3':
                return 'anna'
            case '4':
                return 'masha'
            case 'L':
                return 'marina'
            default:
                return sourceCode
        }
    }

    function getSource(payload: string) {
        switch (payload) {
            case 'a1f6b':
                return 'cofe-i-bileti'
            case 'a9481':
                return 'kosmos-oliferovich'
            default: {
                let source = getSourceTitle(payload[0])

                if (payload.length > 1) {
                    source += `-` + getSourceFrom(payload.substring(1))
                }
                return source
            }
        }
    }

    if (payloads.length > 0) {
        ctx.ua.set('cm', 'referral')

        try {
            const source = getSource(payloads[0])
            analyticRecordReferral(ctx, source)
            ctx.ua.set('cs', source)
        } catch (e) {
            ctx.ua.set('cs', 'fallback')
            ctx.logger.error(e)
        }
    }
}

async function showWelcomeScene(ctx: ContextMessageUpdate, message: { from?: User }) {
    const name = message.from?.first_name ?? undefined
    if (!quick) await sleep(500)

    try {
        const count = await db.repoEventsCommon.countEvents({
            interval: getNextWeekendRange(ctx.now())
        })
        await ctx.replyWithHTML(ctx.i18n.t('root.welcome1', {
            welcome_name: ctx.i18n.t(name ? 'root.welcome_with_name' : 'root.welcome_without_name', {name}),
            eventPlural: generatePlural(ctx, 'event_prepositional', count)
        }))
    } catch (e) {
        ctx.logger.error(e)
    }
    if (!quick) await sleep(1000)

    await ctx.scene.enter('main_scene', {override_main_scene_msg: ctx.i18n.t('root.welcome2')})
}

async function showDirectMessage(ctx: ContextMessageUpdate, extId: string) {
    const event = await db.repoEventsCommon.getEventsByExtId(extId)
    if (event !== undefined) {

        const parsedTimetable = parseAndPredictTimetable(event.timetable, ctx.now(), botConfig)


        const likesRow = getLikesRow(ctx, event)

        const startUsingBot = Markup.button.callback(i18Btn(ctx, 'back_as_new'), 'back_as_new')
        await ctx.replyWithHTML(cardFormat({
            ...event,
            isFuture: isEventInFuture(parsedTimetable.timeIntervals, ctx.now())
        }, { now: ctx.now() }), extraInlineMenu([likesRow, [startUsingBot]]))
        analyticRecordEventView(ctx, event)
        ctx.ua.pv({
            dp: `/start-event/${mySlugify(event.extId)}`,
            dt: `Прямая ссылка > ${event.title}`
        })
    } else {
        ctx.logger.warn(`start event with id '${extId}' is not found. fallback.`)
        await showWelcomeScene(ctx, ctx.message)
    }
}

function preStageGlobalActionsFn(bot: Composer<ContextMessageUpdate>) {
    bot.start(async (ctx: ContextMessageUpdate & { startPayload: string }) => {
        ctx.logger.debug([
            `/start`,
            `id=${ctx.from.id}`,
            `first_name=${ctx.from.first_name}`,
            `last_name=${ctx.from.last_name}`,
            `username=${ctx.from.username}`,
            `startPayload=${ctx.startPayload}`,
            `ua_uuid=${ctx.session.user.uaUuid}`].join(' '))

        const payloads = ctx.startPayload.split('_').filter(s => s !== '')

        setGoogleAnalyticsSource(ctx, payloads)

        const isDirectEvent = ctx.startPayload.match(/event-(.+)$/)
        if (isDirectEvent !== null) {
            await showDirectMessage(ctx, isDirectEvent[1])
        } else {
            await showWelcomeScene(ctx, ctx.message)
        }
    })
}

export const mainScene : SceneRegister = {
    scene,
    preStageGlobalActionsFn,
    postStageActionsFn
}