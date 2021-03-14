import { Composer, Markup, Scenes } from 'telegraf'
import { ContextMessageUpdate, EventCategory, ExtIdAndId, ExtIdAndMaybeId } from '../../interfaces/app-interfaces'
import { i18nSceneHelper, isAdmin, isDev, sleep } from '../../util/scene-helper'
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
import { format, isValid, parse, parseISO } from 'date-fns'
import { ExtraReplyMessage, InlineKeyboardButton, Message, User } from 'telegraf/typings/telegram-types'
import { addMonths } from 'date-fns/fp'
import { SceneRegister } from '../../middleware-utils'
import { logger, loggerTransport } from '../../util/logger'
import { STICKER_CAT_THUMBS_UP } from '../../util/stickers'
import { WrongExcelColumnsError } from '../../dbsync/WrongFormatException'
import { EventToSave } from '../../interfaces/db-interfaces'
import { formatMainAdminMenu, formatMessageForSyncReport } from './admin-format'
import { countEventValidationErrors, getButtonsSwitch, menuCats, SYNC_CONFIRM_TIMEOUT_SECONDS } from './admin-common'
import { EventsSyncDiff, EventToRecover } from '../../database/db-sync-repository'
import { ITask } from 'pg-promise'
import {
    parseAndValidateGoogleSpreadsheetsEvents,
    SpreadSheetValidationError
} from '../../dbsync/parserSpresdsheetEvents'
import {
    enrichPacksSyncDiffWithSavedEventIds,
    EventPackValidated,
    validatePacksForSync
} from '../../dbsync/packsSyncLogic'
import { Dictionary, keyBy, partition } from 'lodash'
import { AdminPager } from './admin-pager'
import { PagingPager } from '../shared/paging-pager'
import { botConfig } from '../../util/bot-config'
import { adminIds, adminUsernames } from '../../util/admins-list'
import { i18n } from '../../util/i18n'
import { formatUserName2 } from '../../util/misc-utils'
import { rawBot } from '../../raw-bot'
import { PacksSyncDiff, PackToSave } from '../../database/db-packs'
import { ExcelPacksSyncResult, fetchAndParsePacks, savePacksValidationErrors } from '../../dbsync/parserSpredsheetPacks'
import { authToExcel } from '@culthub/google-docs'
import { getRedis } from '../../util/reddis'
import got from 'got'
import Timeout = NodeJS.Timeout
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

async function replyWithHTMLMaybeChunk(ctx: ContextMessageUpdate, msg: string, extra?: ExtraReplyMessage) {
    return await chunkanize(msg, async (text, msgExtra) => await ctx.replyWithHTML(text, msgExtra), extra)
}

function listExtIds(eventToSaves: EventToSave[]): string {
    return eventToSaves.map(z => z.primaryData.extId).join(',')
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

function getExistingIdsFrom(eventsDiff: EventsSyncDiff): Dictionary<ExtIdAndId> {
    const existingIds = [...eventsDiff.inserted, ...eventsDiff.recovered, ...eventsDiff.updated, ...eventsDiff.notChanged].map(i => {
        return {
            id: i.primaryData.id ? +i.primaryData.id : undefined,
            extId: i.primaryData.extId
        }
    })
    return keyBy(existingIds, 'extId')
}

function mapValidatedPacksToPacksForSave(eventPacks: EventPackValidated[]): { packsForSave: PackToSave[], unsavedPackEventIds: ExtIdAndMaybeId[] } {
    const unsavedPackEventIds: ExtIdAndMaybeId[] = []

    function realIdOrNegative(extIdAndMaybeId: ExtIdAndMaybeId) {
        if (extIdAndMaybeId.id) {
            return extIdAndMaybeId.id;
        } else {
            unsavedPackEventIds.push(extIdAndMaybeId)
            return -unsavedPackEventIds.length
        }
    }

    const packsForSave: PackToSave[] = eventPacks.map(p => {
        return {
            primaryData: {
                ...p.pack,
                eventIds: p.pack.events.map(realIdOrNegative),
            }
        }
    })
    return { packsForSave, unsavedPackEventIds }
}

function shouldUserConfirmSync(eventsDiff: EventsSyncDiff, packsDiff: PacksSyncDiff, packsErrors: EventPackValidated[]): boolean {
    const countDangers = eventsDiff.deleted.length
        + eventsDiff.recovered
            .filter((i: EventToRecover) => i.old.title !== i.primaryData.title).length
        + packsDiff.deleted.length
        + packsErrors.length
    return countDangers > 0
}

async function statusUpdate(ctx: ContextMessageUpdate, message: Message.TextMessage, id: string, tplData: any = undefined): Promise<void> {
    try {
        await ctx.telegram.editMessageText(message.chat.id, message.message_id, undefined, i18Msg(ctx, id, tplData))
    } catch (e) {
        ctx.logger.warn(e)
    }
}

export async function synchronizeDbByUser(ctx: ContextMessageUpdate): Promise<void> {
    const oldUser = GLOBAL_SYNC_STATE.lockOnSync(ctx)
    if (oldUser !== undefined) {
        await ctx.replyWithHTML(i18Msg(ctx, 'sync_is_locked',
            {user: getHumanReadableUsername(oldUser)}))
        return
    }

    try {

        const message = await ctx.replyWithHTML(i18Msg(ctx, 'sync_status_step_auth', {url: getGoogleSpreadSheetURL()}), {
            disable_web_page_preview: true
        })

        const excel = await authToExcel(botConfig.GOOGLE_AUTH_FILE)

        await statusUpdate(ctx, message, 'sync_status_downloading')

        const eventsSyncResult = await parseAndValidateGoogleSpreadsheetsEvents(db, excel, async sheetTitle => {
            await statusUpdate(ctx, message, 'sync_status_processing', {sheetTitle})
            await ctx.telegram.editMessageText(message.chat.id, message.message_id, undefined, i18Msg(ctx, 'sync_status_processing', {sheetTitle}))
        })

        await statusUpdate(ctx, message, 'sync_status_packs_downloading')
        const packsSyncResult: ExcelPacksSyncResult = await fetchAndParsePacks(excel)
        await statusUpdate(ctx, message, 'sync_status_saving')

        const {eventsDiff, askUserToConfirm, packsDiff, allValidatesPacks, packsErrors} = await db.tx('sync', async (dbTx) => {

            const eventsDiff = await dbTx.repoSync.prepareDiffForSync(eventsSyncResult.rawEvents, dbTx)

            const allValidatesPacks = await validatePacksForSync(packsSyncResult, getExistingIdsFrom(eventsDiff))
            const [packsValid, packsErrors] = partition(allValidatesPacks.filter(s => s.published), p => p.isValid)

            const { packsForSave, unsavedPackEventIds } = mapValidatedPacksToPacksForSave(packsValid)
            const packsDiff = await dbTx.repoPacks.prepareDiffForSync(packsForSave, dbTx)


            GLOBAL_SYNC_STATE.chargeEventsSync(eventsDiff, packsDiff, unsavedPackEventIds, eventsSyncResult.errors, packsErrors)

            const askUserToConfirm = shouldUserConfirmSync(eventsDiff, packsDiff, packsErrors)

            if (askUserToConfirm === false) {
                await GLOBAL_SYNC_STATE.executeSync(dbTx)
            }

            return {eventsDiff, askUserToConfirm, packsDiff, allValidatesPacks, packsErrors}
        })
        await statusUpdate(ctx, message, 'sync_status_packs_validating')
        await savePacksValidationErrors(excel, allValidatesPacks)

        await statusUpdate(ctx, message, 'sync_status_done')

        const body = await formatMessageForSyncReport(eventsSyncResult.errors, packsErrors, eventsDiff, packsDiff, ctx)
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
                `Events.`,
                `inserted={${listExtIds(eventsDiff.inserted)}}`,
                `recovered={${listExtIds(eventsDiff.recovered)}}`,
                `updated={${listExtIds(eventsDiff.updated)}}`,
                `deleted={${eventsDiff.deleted.map(d => d.extId).join(',')}}`
            ].join(' '))

            const msg = i18Msg(ctx, `sync_stats_message`, {
                body
            })

            await replyWithHTMLMaybeChunk(ctx, msg)

            const isSomethingChanged = eventsDiff.deleted.length
                + eventsDiff.recovered.length
                + eventsDiff.inserted.length
                + eventsDiff.updated.length
                + packsDiff.deleted.length
                + packsDiff.recovered.length
                + packsDiff.inserted.length
                + packsDiff.deleted.length
                > 0
            if (countEventValidationErrors(eventsSyncResult.errors) + packsErrors.length === 0 && isSomethingChanged) {
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
    private eventsSyncDiff: EventsSyncDiff
    private packsSyncDiff: PacksSyncDiff
    private packsErrors: EventPackValidated[]
    private confirmIdMsg: Message
    private user: User
    private eventsErrors: SpreadSheetValidationError[] = []
    private unsavedPackEventIds: ExtIdAndMaybeId[]

    public getStatus() {
        if (this.user === undefined) {
            return `global state empty`
        } else {
            return `global state sync_owner=${this.user?.username} Size=${JSON.stringify(this).length}`
        }
    }

    public async executeSync(dbTx: ITask<IExtensions> & IExtensions) {
        logger.debug('hasData?', this.eventsSyncDiff !== undefined)
        this.stopOldTimerIfExists()
        try {
            logger.debug('hasData?', this.eventsSyncDiff !== undefined)
            await dbTx.repoSync.syncDiff(this.eventsSyncDiff, dbTx)

            enrichPacksSyncDiffWithSavedEventIds(this.packsSyncDiff, getExistingIdsFrom(this.eventsSyncDiff), this.unsavedPackEventIds)
            await dbTx.repoPacks.syncDiff(this.packsSyncDiff, dbTx)

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
        this.eventsSyncDiff = undefined
        this.packsSyncDiff = undefined
        this.unsavedPackEventIds = undefined
        this.user = undefined
        this.confirmIdMsg = undefined
        this.eventsErrors = []
        this.packsErrors = []
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

    chargeEventsSync(eventsDiff: EventsSyncDiff, packsSyncDiff: PacksSyncDiff, unsavedPackEventIds: ExtIdAndMaybeId[], validationErrors: SpreadSheetValidationError[], packsErrors: EventPackValidated[]) {
        logger.debug('Charge')
        this.eventsSyncDiff = eventsDiff
        this.packsSyncDiff = packsSyncDiff
        this.unsavedPackEventIds = unsavedPackEventIds
        this.eventsErrors = validationErrors
        this.packsErrors = packsErrors
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
            body: await formatMessageForSyncReport(this.eventsErrors, this.packsErrors, this.eventsSyncDiff, this.packsSyncDiff, ctx),
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

let sessionSafeDestroyCounter = 3;
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
    .command('redis_reset', async ctx => {
        async function countKeys() {
            return (await getRedis().keys('*')).length
        }

        if (isDev(ctx)) {
            if (sessionSafeDestroyCounter-- === 0) {
                sessionSafeDestroyCounter = 3;
                const keysBefore = await countKeys()
                await getRedis().flushdb()
                ctx.reply(`Done. ${keysBefore} -> ${await countKeys()} keys`)
            } else {
                ctx.reply(`type ${ctx.message.text} again (${sessionSafeDestroyCounter})`)
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
                backupRows[key] = JSON.parse(data)
            }
            const buffer = Buffer.from(JSON.stringify(backupRows, undefined, 2))
            ctx.replyWithDocument({
                source: buffer,
                filename: `sessions-${botConfig.HEROKU_APP_NAME}-${format(new Date(), 'yyyy-MM-dd--HH-mm-ss')}.json`
            })
            ctx.session.adminScene.reddisBackupIsDone = true
        }
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
                        await getRedis().set(key, JSON.stringify(value))
                    }
                    ctx.replyWithHTML(`Обновили сессии для ${Object.entries(response).length} элементов.`)
                } else {
                    ctx.replyWithHTML('Опасно, вначале скачать бекап.')
                }
            } else {
                ctx.replyWithHTML('Ожидался файл session-*.json')
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
    await ctx.editMessageText(cardFormat(event, {showAdminInfo: true, now: ctx.now() }), {
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
        .action(/admin_scene[.]snapshot_(\w+)$/, async (ctx) => {
            await switchCard(ctx, 'snapshot')
        })
        .action(/admin_scene[.]current_(\w+)$/, async (ctx) => {
            await switchCard(ctx, 'current')
        })

    bot.use(Composer.optional(ctx => isAdmin(ctx), adminGlobalCommands))
}

export const adminScene: SceneRegister = {
    scene,
    postStageActionsFn
}
