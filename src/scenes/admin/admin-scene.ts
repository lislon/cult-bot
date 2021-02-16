import { Composer, Markup, Scenes } from 'telegraf'
import { ContextMessageUpdate, EventCategory, ExtIdAndId } from '../../interfaces/app-interfaces'
import { i18nSceneHelper, isAdmin, sleep } from '../../util/scene-helper'
import { cardFormat } from '../shared/card-format'
import {
    chunkanize,
    getGoogleSpreadSheetURL,
    replyWithBackToMainMarkup,
    ruFormat,
    showBotVersion,
    warnAdminIfDateIsOverriden
} from '../shared/shared-logic'
import { db, IExtensions, pgLogOnlyErrors, pgLogVerbose } from '../../database/db'
import { isValid, parse, parseISO } from 'date-fns'
import { ExtraReplyMessage, InlineKeyboardButton, Message, User } from 'telegraf/typings/telegram-types'
import { addMonths } from 'date-fns/fp'
import { SceneRegister } from '../../middleware-utils'
import { logger, loggerTransport } from '../../util/logger'
import { STICKER_CAT_THUMBS_UP } from '../../util/stickers'
import { WrongExcelColumnsError } from '../../dbsync/WrongFormatException'
import { EventToSave } from '../../interfaces/db-interfaces'
import { formatMainAdminMenu, formatMessageForSyncReport } from './admin-format'
import { getButtonsSwitch, menuCats, SYNC_CONFIRM_TIMEOUT_SECONDS, totalValidationErrors } from './admin-common'
import { EventToRecover, SyncDiff } from '../../database/db-sync-repository'
import { ITask } from 'pg-promise'
import { parseAndValidateGoogleSpreadsheets, SpreadSheetValidationError } from '../../dbsync/parserSpresdsheetEvents'
import { authToExcel } from '../../dbsync/googlesheets'
import {
    eventPacksEnrichWithIds,
    EventPackValidated,
    getOnlyValid,
    prepareForPacksSync
} from '../../dbsync/packsSyncLogic'
import { Dictionary, keyBy } from 'lodash'
import { AdminPager } from './admin-pager'
import { PagingPager } from '../shared/paging-pager'
import { botConfig } from '../../util/bot-config'
import { adminIds, adminUsernames } from '../../util/admins-list'
import { i18n } from '../../util/i18n'
import { rawBot } from '../../bot'
import { formatUserName2 } from '../../util/misc-utils'
import Timeout = NodeJS.Timeout

const scene = new Scenes.BaseScene<ContextMessageUpdate>('admin_scene')

const pager = new PagingPager(new AdminPager())

export interface AdminSceneQueryState {
    cat?: EventCategory,
    reviewer?: string,
}

export interface AdminSceneState extends AdminSceneQueryState {
    overrideDate?: string
}

const {actionName, i18SharedBtn, i18Btn, i18Msg} = i18nSceneHelper(scene)

async function replyWithHTMLMaybeChunk(ctx: ContextMessageUpdate, msg: string, extra?: ExtraReplyMessage) {
    return await chunkanize(msg, async (text, msgExtra) => await ctx.replyWithHTML(text, msgExtra), extra)
}

function listExtIds(eventToSaves: EventToSave[]): string {
    return eventToSaves.map(z => z.primaryData.ext_id).join(',')
}

function getUserFromCtx(ctx: ContextMessageUpdate): User {
    if ('message' in ctx.update) {
        return ctx.update.message.from
    } else if ('callback_query' in ctx.update) {
        return ctx.update.callback_query.from
    } else {
        return {
            id: 0,
            username: 'unknown',
            last_name: '',
            first_name: '',
            language_code: 'ru',
            is_bot: false
        }
    }
}

function getHumanReadableUsername(user: User): string {
    return user.first_name || user.last_name || user.username || user.id + ''
}

function getExistingIdsFrom(dbDiff: SyncDiff): Dictionary<ExtIdAndId> {
    const existingIds = [...dbDiff.insertedEvents, ...dbDiff.recoveredEvents, ...dbDiff.updatedEvents, ...dbDiff.notChangedEvents].map(i => {
        return {
            id: i.primaryData.id ? +i.primaryData.id : undefined,
            extId: i.primaryData.ext_id
        }
    })
    return keyBy(existingIds, 'extId')
}

export async function synchronizeDbByUser(ctx: ContextMessageUpdate) {
    const oldUser = GLOBAL_SYNC_STATE.lockOnSync(ctx)
    if (oldUser !== undefined) {
        await ctx.replyWithHTML(i18Msg(ctx, 'sync_is_locked',
            {user: getHumanReadableUsername(oldUser)}))
        return
    }

    try {

        await ctx.replyWithHTML(i18Msg(ctx, 'sync_start', {url: getGoogleSpreadSheetURL()}), {
            disable_web_page_preview: true
        })

        const excel = await authToExcel()
        const syncResult = await parseAndValidateGoogleSpreadsheets(db, excel)
        // const {validationErrors, rows, excelUpdater} = await parseAndValidateGoogleSpreadsheets()

        const {dbDiff, askUserToConfirm, eventPacks} = await db.tx('sync', async (dbTx) => {

            const dbDiff = await dbTx.repoSync.prepareDiffForSync(syncResult.rawEvents, dbTx)

            const eventPacks = await prepareForPacksSync(excel, getExistingIdsFrom(dbDiff))

            GLOBAL_SYNC_STATE.chargeEventsSync(dbDiff, eventPacks, syncResult.errors)

            const askUserToConfirm = dbDiff.deletedEvents.length
                + dbDiff.recoveredEvents
                    .filter((i: EventToRecover) => i.old.title !== i.primaryData.title).length > 0

            if (askUserToConfirm === false) {
                await GLOBAL_SYNC_STATE.executeSync(dbTx)
            }
            return {dbDiff, askUserToConfirm, eventPacks}
        })

        const body = await formatMessageForSyncReport(syncResult.errors, dbDiff, eventPacks, ctx)
        if (askUserToConfirm === true) {
            const keyboard = [[
                Markup.button.callback(i18Btn(ctx, 'sync_back'), actionName('sync_back')),
                Markup.button.callback(i18Btn(ctx, 'sync_confirm'), actionName('sync_confirm')),
            ]]
            const msgId = await replyWithHTMLMaybeChunk(ctx, i18Msg(ctx, 'sync_ask_user_to_confirm', {
                body
            }), {...Markup.inlineKeyboard(keyboard), parse_mode: 'HTML'})

            GLOBAL_SYNC_STATE.saveConfirmIdMessage(msgId)

        } else {

            ctx.logger.info([
                `Database updated.`,
                `Insertion done.`,
                `inserted={${listExtIds(dbDiff.insertedEvents)}}`,
                `recovered={${listExtIds(dbDiff.recoveredEvents)}}`,
                `updated={${listExtIds(dbDiff.updatedEvents)}}`,
                `deleted={${dbDiff.deletedEvents.map(d => d.ext_id).join(',')}}`
            ].join(' '))

            const msg = i18Msg(ctx, `sync_stats_message`, {
                body,
                rows: await db.repoAdmin.countTotalRows()
            })

            await replyWithHTMLMaybeChunk(ctx, msg)

            const isSomethingChanged = dbDiff.deletedEvents.length
                + dbDiff.recoveredEvents.length
                + dbDiff.insertedEvents.length
                + dbDiff.updatedEvents.length > 0
            if (totalValidationErrors(syncResult.errors) === 0 && isSomethingChanged) {
                await sleep(500)
                await ctx.replyWithSticker(STICKER_CAT_THUMBS_UP)
            }
        }
    } catch (e) {
        if (e instanceof WrongExcelColumnsError) {
            await ctx.replyWithHTML(i18Msg(ctx, 'sync_wrong_format', e.data))
        } else {
            await ctx.replyWithHTML(i18Msg(ctx, 'sync_error', {error: e.toString().substr(0, 100)}))
            throw e
        }
    }
}

class GlobalSync {
    private timeoutId: Timeout
    private syncDiff: SyncDiff
    private eventPacks: EventPackValidated[]
    private confirmIdMsg: Message
    private user: User
    private validationErrors: SpreadSheetValidationError[] = []

    public getStatus() {
        if (this.user === undefined) {
            return `global state empty`
        } else {
            return `global state sync_owner=${this.user?.username} Size=${JSON.stringify(this).length}`
        }
    }

    public async executeSync(dbTx: ITask<IExtensions> & IExtensions) {
        logger.debug('hasData?', this.syncDiff !== undefined)
        this.stopOldTimerIfExists()
        try {
            logger.debug('hasData?', this.syncDiff !== undefined)
            await dbTx.repoSync.syncDiff(this.syncDiff, dbTx)
            const eventPackForSaves = eventPacksEnrichWithIds(getOnlyValid(this.eventPacks), getExistingIdsFrom(this.syncDiff))
            await dbTx.repoPacks.sync(eventPackForSaves)

            await this.notifyAdminsAboutSync()

            logger.debug('Sync done')
        } finally {
            this.cleanup()
        }
    }

    public abort() {
        this.stopOldTimerIfExists()
        this.cleanup()
        logger.debug('Abort done')
    }

    private cleanup() {
        this.syncDiff = undefined
        this.user = undefined
        this.confirmIdMsg = undefined
        this.eventPacks = undefined
        this.validationErrors = []
    }

    public isRunning(ctx: ContextMessageUpdate) {
        const user = getUserFromCtx(ctx)
        return this.user?.id === user.id
    }

    private startTimer() {
        logger.debug('Start cancel timer')
        this.stopOldTimerIfExists()
        this.cleanup()
        this.timeoutId = setTimeout(() => {
            logger.debug('Timer hit')
            this.timeoutId = undefined
            this.abort()
        }, SYNC_CONFIRM_TIMEOUT_SECONDS * 1000)
    }

    private stopOldTimerIfExists() {
        if (this.timeoutId !== undefined) {
            logger.debug('Stop timer')
            clearTimeout(this.timeoutId)
        }
    }

    lockOnSync(ctx: ContextMessageUpdate): User {
        const user = getUserFromCtx(ctx)
        if (this.user === undefined || this.user.id === user.id) {
            this.startTimer()
            this.user = user
            ctx.logger.debug('Lock done')
            return undefined
        }
        ctx.logger.debug('Lock fail')
        return this.user
    }

    chargeEventsSync(dbDiff: SyncDiff, eventPacks: EventPackValidated[], validationErrors: SpreadSheetValidationError[]) {
        logger.debug('Charge')
        this.syncDiff = dbDiff
        this.eventPacks = eventPacks
        this.validationErrors = validationErrors
    }

    saveConfirmIdMessage(msg: Message) {
        this.confirmIdMsg = msg
    }


    private async notifyAdminsAboutSync() {
        const admins = (await db.repoUser.findUsersByUsernamesOrIds(adminUsernames, adminIds))
            .filter(u => u.tid !== this.user.id)

        const ctx: ContextMessageUpdate = {} as ContextMessageUpdate
        i18n.middleware()(ctx, () => Promise.resolve())

        const text = i18n.t('ru', 'scenes.admin_scene.sync_report', {
            body: await formatMessageForSyncReport(this.validationErrors, this.syncDiff, this.eventPacks, ctx),
            rows: await db.repoAdmin.countTotalRows(),
            user: formatUserName2(this.user)
        })
        for (const admin of admins) {
            try {
                await chunkanize(text, async (chunk, extra) => {
                    return await rawBot.telegram.sendMessage(admin.tid, chunk, extra)
                }, {
                    parse_mode: 'HTML',
                    disable_notification: true
                })
                await sleep(200)
            } catch (e) {
                logger.warn(`failed to send to admin.id = ${admin.id}`)
                logger.warn(e)
            }
        }
    }
}

const GLOBAL_SYNC_STATE = new GlobalSync()

async function replySyncNoTransaction(ctx: ContextMessageUpdate) {
    ctx.logger.warn(`sync already in progress (${GLOBAL_SYNC_STATE.getStatus()})`)
    await ctx.replyWithHTML(i18Msg(ctx, 'sync_no_transaction', {
        minutes: Math.ceil(SYNC_CONFIRM_TIMEOUT_SECONDS / 60),
        status: GLOBAL_SYNC_STATE.getStatus()
    }))
}

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
    await ctx.editMessageText(cardFormat(event, {showAdminInfo: true}), {
        ...Markup.inlineKeyboard(buttons),
        parse_mode: 'HTML',
        disable_web_page_preview: true
    })
}

function postStageActionsFn(bot: Composer<ContextMessageUpdate>) {
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
                await ctx.replyWithHTML(i18Msg(ctx, 'sync_confirmed', {
                    rows: await db.repoAdmin.countTotalRows()
                }))
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
        .action(/admin_scene[.]snapshot_(\w+)$/, async (ctx) => {
            await switchCard(ctx, 'snapshot')
        })
        .action(/admin_scene[.]current_(\w+)$/, async (ctx) => {
            await switchCard(ctx, 'current')
        })

    bot.use(Composer.optional(ctx => isAdmin(ctx), adminGlobalCommands))
}

export const adminScene = {
    scene,
    postStageActionsFn
} as SceneRegister
