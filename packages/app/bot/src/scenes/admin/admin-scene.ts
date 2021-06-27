import { Composer, Markup, Scenes } from 'telegraf'
import { ContextMessageUpdate } from '../../interfaces/app-interfaces'
import { EventCategory } from '@culthub/interfaces'
import { i18nSceneHelper, isAdmin, isDev } from '../../util/scene-helper'
import { cardFormat } from '../shared/card-format'
import { replyWithBackToMainMarkup, ruFormat, showBotVersion, warnAdminIfDateIsOverriden } from '../shared/shared-logic'
import { db, IExtensions, pgLogOnlyErrors, pgLogVerbose } from '../../database/db'
import { format, isValid, parse, parseISO } from 'date-fns'
import { InlineKeyboardButton, Message } from 'typegram'
import { addMonths } from 'date-fns/fp'
import { SceneRegister } from '../../middleware-utils'
import { loggerTransport } from '../../util/logger'
import { formatMainAdminMenu, formatPartnerLinkAdded, formatPartnerLinks } from './admin-format'
import { getButtonsSwitch, getHumanReadableUsername, getUserFromCtx, menuCats } from './admin-common'
import { ITask } from 'pg-promise'
import { AdminPager } from './admin-pager'
import { PagingPager } from '../shared/paging-pager'
import { botConfig } from '../../util/bot-config'
import { getRedis } from '../../util/reddis'
import got from 'got'
import debugNamespace from 'debug'
import { GLOBAL_SYNC_STATE, replySyncNoTransaction, synchronizeDbByUser } from './admin-sync'
import { Referral } from '../../database/db-referral'
import DocumentMessage = Message.DocumentMessage

function isDocumentMessage(msg: Message): msg is DocumentMessage {
    return 'document' in msg
}


const scene = new Scenes.BaseScene<ContextMessageUpdate>('admin_scene')

const pager = new PagingPager(new AdminPager())

export interface AdminSceneQueryState {
    cat?: EventCategory,
    reviewer?: string,
}

export interface AdminSceneState extends AdminSceneQueryState {
    overrideDate?: string
    reddisBackupIsDone?: boolean
}

const {actionName, i18Btn, i18Msg} = i18nSceneHelper(scene)


let sessionSafeDestroyCounter = 3

scene
    .use(async (ctx: ContextMessageUpdate, next: () => Promise<void>) => {
        if (!isAdmin(ctx)) {
            ctx.logger.warn('User is not more admin. Redirect it to main_scene')
            await ctx.scene.enter('main_scene')
        } else {
            await next()
        }
    })
    .enter(async ctx => {
        await prepareSessionStateIfNeeded(ctx)
        await replyWithBackToMainMarkup(ctx)
        const {msg, markup} = await formatMainAdminMenu(ctx)
        await ctx.replyWithHTML(msg, markup)
    })
    .use(pager.middleware())
    .action(actionName('sync'), async ctx => {
        await ctx.answerCbQuery()
        await synchronizeDbByUser(ctx)
    })
    .action(actionName('links'), async ctx => {
        await ctx.answerCbQuery()
        await formatPartnerLinks(ctx, await db.repoReferral.list())
    })
    .command('la', async ctx => {
        const match = ctx.message.text.match(/\/la\s+(?<code>[a-z0-9-]+)\s+(?<title>[A-Za-z0-9-]+)\s*(?<redirect>[A-Za-z][0-9]+[a-zA-Z]?)?\s*(?<comment>.+)?/)
        if (match) {
            try {
                const referral: Referral = {
                    code: match.groups['code'].toLowerCase(),
                    gaSource: match.groups['title'].toLowerCase(),
                    redirect: (match.groups['redirect'] || '').toUpperCase(),
                    description: (match.groups['comment'] || '')
                }
                await db.repoReferral.add(referral)
                await formatPartnerLinkAdded(ctx, referral)
            } catch (e) {
                await ctx.replyWithHTML(`Ошибка! Код <b>${match.groups['code']}</b> или название <b>${match.groups['title']}</b> уже есть в базе\n\n\n` + e)
            }
        } else {
            await ctx.replyWithHTML(i18Msg(ctx, 'link_add_invalid_format'))
        }
    })
    .command('poll', async ctx => {
        await ctx.replyWithPoll(
            'Your favorite math constant',
            ['x', 'e', 'π', 'φ', 'γ'],
            {is_anonymous: false})
    })
    .on('message', async (ctx, next) => {
        const msg = ctx.message
        if (isDocumentMessage(msg) && isDev(ctx)) {
            if (msg.document.file_name.startsWith('session') && msg.document.file_name.endsWith('.json')) {

                if (ctx.session.adminScene.reddisBackupIsDone) {
                    const fileLink = await ctx.telegram.getFileLink(msg.document.file_id)
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const response = await got(fileLink).json<any>()

                    for (const [key, value] of Object.entries(response)) {
                        await getRedis().set(key, value as string)
                    }
                    await ctx.replyWithHTML(`Обновили сессии для ${Object.entries(response).length} элементов.`)
                } else {
                    await ctx.replyWithHTML('Опасно, вначале скачать бекап.')
                }
            } else {
                await ctx.replyWithHTML('Ожидался файл session-*.json')
            }
        }
        return await next()
    })
    .action(actionName('version'), async ctx => {
        await ctx.answerCbQuery()
        await showBotVersion(ctx)
    })
    .action(new RegExp(`${actionName('r_')}(.+)`), async ctx => {
        // db.repoAdmin.findAllEventsByReviewer(ctx.match[1], getNextWeekEndRange(ctx.now()), )
        await ctx.answerCbQuery()
        await startNewPaging(ctx)
        ctx.session.adminScene.reviewer = ctx.match[1]

        await pager.updateState(ctx, {
            cat: ctx.session.adminScene.cat,
            reviewer: ctx.session.adminScene.reviewer
        })
        await pager.initialShowCards(ctx)
    })
    .action('fake', async (ctx) => await ctx.answerCbQuery(i18Msg(ctx, 'just_a_button')))

menuCats.flatMap(m => m).forEach(menuItem => {
    scene.action(actionName(menuItem), async ctx => {
        await ctx.answerCbQuery()
        await startNewPaging(ctx)
        ctx.session.adminScene.cat = menuItem as EventCategory

        await pager.updateState(ctx, {
            cat: ctx.session.adminScene.cat,
            reviewer: ctx.session.adminScene.reviewer
        })
        await pager.initialShowCards(ctx)
    })
})

async function startNewPaging(ctx: ContextMessageUpdate) {
    await prepareSessionStateIfNeeded(ctx)
    ctx.session.adminScene.cat = undefined
    ctx.session.adminScene.reviewer = undefined
    await warnAdminIfDateIsOverriden(ctx)
}

async function prepareSessionStateIfNeeded(ctx: ContextMessageUpdate) {
    if (!ctx.scene.current) {
        await ctx.scene.enter('admin_scene', undefined, true)
    }
    if (ctx.session.adminScene === undefined) {
        ctx.session.adminScene = {
            reddisBackupIsDone: undefined,
            cat: undefined,
            reviewer: undefined,
            overrideDate: undefined
        }
    }
}

function findExistingButtonRow(ctx: ContextMessageUpdate, predicate: (btn: InlineKeyboardButton.CallbackButton) => boolean): InlineKeyboardButton.CallbackButton[] {
    const existingKeyboard = (ctx as any).update?.callback_query?.message?.reply_markup?.inline_keyboard as InlineKeyboardButton.CallbackButton[][]
    return existingKeyboard?.find(btns => btns.find(predicate) !== undefined)
}

function findButton(ctx: ContextMessageUpdate, predicate: (btn: InlineKeyboardButton.CallbackButton) => boolean): InlineKeyboardButton.CallbackButton {
    const existingKeyboard = (ctx as any).update?.callback_query?.message?.reply_markup?.inline_keyboard as InlineKeyboardButton.CallbackButton[][]
    return existingKeyboard?.flatMap(rows => rows).find(predicate)
}

function isCurrentButtonAlreadySelected(ctx: ContextMessageUpdate, version: 'current' | 'snapshot') {
    const currentStateBtn = findButton(ctx, btn => btn.callback_data.includes(version))
    const icon = i18Btn(ctx, `${version}_active_icon`)
    return currentStateBtn?.text.includes(icon)
}

async function switchCard(ctx: ContextMessageUpdate & { match: RegExpExecArray }, version: 'current' | 'snapshot') {
    const extId = ctx.match[1].toUpperCase()
    await ctx.answerCbQuery()
    if (isCurrentButtonAlreadySelected(ctx, version)) {
        return
    }

    const event = await db.repoAdmin.findSnapshotEvent(extId, version)
    const existingKeyboard = findExistingButtonRow(ctx, btn => btn.callback_data === actionName('show_more'))
    const buttons = [getButtonsSwitch(ctx, extId, version), ...(existingKeyboard ? [existingKeyboard] : [])]
    await ctx.editMessageText(cardFormat(event, {showAdminInfo: true, now: ctx.now()}), {
        ...Markup.inlineKeyboard(buttons),
        parse_mode: 'HTML',
        disable_web_page_preview: true
    })
}

function postStageActionsFn(bot: Composer<ContextMessageUpdate>): void {
    const adminGlobalCommands = new Composer<ContextMessageUpdate>()
        .command('adminGlobalCommands', async ctx => {
            await ctx.scene.enter('admin_scene')
        })
        .command('time_now', async ctx => {
            ctx.session.adminScene.overrideDate = undefined
            await ctx.replyWithHTML(i18Msg(ctx, 'time_override.reset'))
        })
        .command('time', async ctx => {
            const HUMAN_OVERRIDE_FORMAT = 'dd MMMM yyyy HH:mm, iiii'

            await prepareSessionStateIfNeeded(ctx)
            const dateStr = ctx.message.text.replace(/^\/time[\s]*/, '')
            if (dateStr === undefined || dateStr === 'now') {
                ctx.session.adminScene.overrideDate = undefined
                await ctx.replyWithHTML(i18Msg(ctx, 'time_override.reset'))
            } else if (dateStr === '') {
                await ctx.replyWithHTML(i18Msg(ctx, 'time_override.status',
                    {
                        time: ruFormat(
                            (ctx.session.adminScene.overrideDate
                                ? parseISO(ctx.session.adminScene.overrideDate)
                                : new Date())
                            , HUMAN_OVERRIDE_FORMAT)
                    }))
            } else {
                const now = new Date()
                let parsed = parse(dateStr, 'yyyy-MM-dd HH:mm', now)

                if (!isValid(parsed) && dateStr.match(/^\d{1,2}$/)) {
                    parsed = new Date(now.getFullYear(), now.getMonth(), +dateStr)
                    if (now.getDay() > +dateStr) {
                        parsed = addMonths(1)(parsed)
                    }
                } else if (!isValid(parsed)) {
                    parsed = undefined
                }
                if (parsed !== undefined) {
                    ctx.session.adminScene.overrideDate = parsed.toISOString()
                    await ctx.replyWithHTML(i18Msg(ctx, 'time_override.changed', {time: ruFormat(parsed, HUMAN_OVERRIDE_FORMAT)}))
                } else {
                    await ctx.replyWithHTML(i18Msg(ctx, 'time_override.invalid'))
                }
            }
        })
        .command('version', async (ctx) => {
            await showBotVersion(ctx)
        })
        .command('sync', async (ctx) => {
            await synchronizeDbByUser(ctx)
        })
        .command(['log', 'level'], async (ctx) => {
            await ctx.replyWithHTML(i18Msg(ctx, 'select_log_level'))
        })
        .command('debug', async (ctx) => {
            const newNamespace = ctx.message.text.replace('/debug', '').trim()
            if (newNamespace === '') {
                const oldNamespace = debugNamespace.disable()
                await ctx.replyWithHTML(`Debug disabled. to enable:\n/debug ${oldNamespace}`)
            } else {
                debugNamespace.enable(newNamespace)
                await ctx.replyWithHTML(`Debug enabled: DEBUG='${newNamespace}'`)
            }
        })
        .command('snapshot', async (ctx) => {
            await db.repoSnapshot.takeSnapshot(getHumanReadableUsername(getUserFromCtx(ctx)), new Date())
            await ctx.replyWithHTML(i18Msg(ctx, 'snapshot_taken'))
        })
        .command('sess', async (ctx) => {
            const chatId = ctx.message.text.replace(/^\/sess[_\s]*/, '')
            await ctx.replyWithHTML(`rdcli -h your.redis.host -a yourredispassword -p 11111\nGET ${chatId}:${chatId}\n<i>Your id: ${ctx.chat.id}</i>`)
        })
        .command(['level_silly', 'level_debug', 'level_error'], async (ctx) => {
            loggerTransport.level = ctx.message.text.replace(/^\/[^_]+_/, '')
            await ctx.replyWithHTML(i18Msg(ctx, 'log_level_selected', {level: loggerTransport.level}))
            if (loggerTransport.level === 'silly') {
                pgLogVerbose()
            } else {
                pgLogOnlyErrors()
            }
        })
        .action(actionName('sync_back'), async ctx => {
            await ctx.answerCbQuery()
            if (GLOBAL_SYNC_STATE.isRunning(ctx)) {
                GLOBAL_SYNC_STATE.abort()
                await ctx.editMessageReplyMarkup(Markup.inlineKeyboard([]).reply_markup)
                await ctx.replyWithHTML(i18Msg(ctx, 'sync_cancelled'))
            } else {
                await replySyncNoTransaction(ctx)
            }
        })
        .action(actionName('sync_confirm'), async ctx => {
            await ctx.answerCbQuery()
            if (GLOBAL_SYNC_STATE.isRunning(ctx)) {
                await db.tx(async (dbTx: ITask<IExtensions> & IExtensions) => {
                    await GLOBAL_SYNC_STATE.executeSync(dbTx)
                })
                await ctx.editMessageReplyMarkup(Markup.inlineKeyboard([]).reply_markup)
                await ctx.replyWithHTML(i18Msg(ctx, 'sync_confirmed'))
            } else {
                await replySyncNoTransaction(ctx)
            }
        })
        .command('bot_config', async (ctx) => {
            function maskInfo(key: string, value: string) {
                const maskedValue = value
                if (key.includes('URL') || key.includes('PASS') || key.includes('KEY') || key.includes('TOKEN')) {
                    return '***'
                }
                return maskedValue
            }

            const cmdKeyValue = ctx.message.text.split(' ')

            function convertValue(value: string) {
                if (value === 'true') {
                    return true
                } else if (value === 'false') {
                    return false
                } else if (!isNaN(+value)) {
                    return +value
                }
                return value
            }

            if (cmdKeyValue.length === 3) {
                const [, key, value] = cmdKeyValue
                if (key in botConfig) {
                    (botConfig as any)[key] = convertValue(value)
                    await ctx.replyWithHTML(`Success!`)
                } else {
                    await ctx.replyWithHTML(`Key ${key} not exists in botConfig`)
                }
            } else {
                await ctx.replyWithHTML(`<code>${(JSON.stringify(botConfig, maskInfo, 2))}</code>`)
            }
        })
        .action(/admin_scene[.]snapshot_(\w+)$/, async ctx => {
            await switchCard(ctx, 'snapshot')
        })
        .action(/admin_scene[.]current_(\w+)$/, async ctx => {
            await switchCard(ctx, 'current')
        })
        .command('pl', async ctx => {
            const limit = +ctx.message.text.replace(/[^\d]/g, '')
            return await formatPartnerLinks(ctx, await db.repoReferral.list(), isNaN(limit) ? undefined : limit)
        })
        .command('redis_reset', async ctx => {
            async function countKeys() {
                return (await getRedis().keys('*')).length
            }

            if (isDev(ctx)) {
                if (sessionSafeDestroyCounter-- === 0) {
                    sessionSafeDestroyCounter = 3
                    const keysBefore = await countKeys()
                    setTimeout(async () => {
                        await getRedis().flushdb()
                        await ctx.reply(`Done. ${keysBefore} -> ${await countKeys()} keys for ${botConfig.HEROKU_APP_NAME}`)
                    }, 1000)
                } else {
                    await ctx.reply(`type ${ctx.message.text} again (${sessionSafeDestroyCounter}) for ${botConfig.HEROKU_APP_NAME}`)
                }
            }
        })
        .command('redis_backup', async ctx => {
            if (isDev(ctx)) {
                const keys = await getRedis().keys('*')
                await ctx.reply(`Готовим... ${keys.length} сессий`)

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const backupRows: any = {}
                for (const key of keys) {
                    const data = await getRedis().get(key)
                    backupRows[key] = data
                }
                const buffer = Buffer.from(JSON.stringify(backupRows, undefined, 2))
                await ctx.replyWithDocument({
                    source: buffer,
                    filename: `sessions-${botConfig.HEROKU_APP_NAME}-${format(new Date(), 'yyyy-MM-dd--HH-mm-ss')}.json`
                })
                ctx.session.adminScene.reddisBackupIsDone = true
            }
        })

    bot.use(Composer.optional(ctx => isAdmin(ctx), adminGlobalCommands))
}

export const adminScene: SceneRegister = {
    scene,
    postStageActionsFn
}
