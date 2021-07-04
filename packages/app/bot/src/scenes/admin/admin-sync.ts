import { ContextMessageUpdate, ExtIdAndId, ExtIdAndMaybeId } from '../../interfaces/app-interfaces'
import { Message, User } from 'typegram'
import { authToExcel } from '@culthub/google-docs'
import { botConfig } from '../../util/bot-config'
import {
    parseAndValidateGoogleSpreadsheetsEvents,
    SpreadSheetValidationError
} from '../../dbsync/parserSpresdsheetEvents'
import { db, IExtensions } from '../../database/db'
import { ExcelPacksSyncResult, fetchAndParsePacks, savePacksValidationErrors } from '../../dbsync/parserSpredsheetPacks'
import {
    enrichPacksSyncDiffWithSavedEventIds,
    EventPackValidated,
    validatePacksForSync
} from '../../dbsync/packsSyncLogic'
import { Dictionary, keyBy, partition } from 'lodash'
import { formatMessageForSyncReport } from './admin-format'
import { Markup, Scenes } from 'telegraf'
import {
    countEventValidationErrors,
    getHumanReadableUsername,
    getUserFromCtx,
    SYNC_CONFIRM_TIMEOUT_SECONDS
} from './admin-common'
import { i18nSceneHelper, sleep } from '../../util/scene-helper'
import { STICKER_CAT_THUMBS_UP } from '../../util/stickers'
import { WrongExcelColumnsError } from '../../dbsync/WrongFormatException'
import { EventsSyncDiff, EventToRecover } from '../../database/db-sync-repository'
import { PacksSyncDiff, PackToSave } from '../../database/db-packs'
import { ITask } from 'pg-promise'
import { logger } from '../../util/logger'
import { adminIds, adminUsernames } from '../../util/admins-list'
import { i18n } from '../../util/i18n'
import { formatUserName2 } from '../../util/misc-utils'
import { chunkanize, getGoogleSpreadSheetURL } from '../shared/shared-logic'
import { rawBot } from '../../raw-bot'
import { ExtraReplyMessage } from 'telegraf/typings/telegram-types'
import { EventToSave } from '../../interfaces/db-interfaces'
import Timeout = NodeJS.Timeout

const scene = new Scenes.BaseScene<ContextMessageUpdate>('admin_scene')
const {actionName, i18Btn, i18Msg} = i18nSceneHelper(scene)

async function statusUpdate(ctx: ContextMessageUpdate, message: Message.TextMessage, id: string, tplData: any = undefined): Promise<void> {
    return await editDirectMessage(ctx, message, i18Msg(ctx, id, tplData))
}

async function editDirectMessage(ctx: ContextMessageUpdate, message: Message.TextMessage, text: string) {
    try {
        await ctx.telegram.editMessageText(message.chat.id, message.message_id, undefined, text)
    } catch (e) {
        ctx.logger.warn(e)
    }
}

async function asyncSync(ctx: ContextMessageUpdate, message: Message.TextMessage) {
    try {

        const excel = await authToExcel(botConfig.GOOGLE_AUTH_FILE)

        await statusUpdate(ctx, message, 'sync_status_downloading')
        const eventsSyncResult = await parseAndValidateGoogleSpreadsheetsEvents(db, excel, async sheetTitle => {
            await statusUpdate(ctx, message, 'sync_status_processing', {sheetTitle})
            await ctx.telegram.editMessageText(message.chat.id, message.message_id, undefined, i18Msg(ctx, 'sync_status_processing', {sheetTitle}))
        })
        await statusUpdate(ctx, message, 'sync_status_packs_downloading')
        const packsSyncResult: ExcelPacksSyncResult = await fetchAndParsePacks(excel)
        await statusUpdate(ctx, message, 'sync_status_saving')

        // await statusUpdate(ctx, message, 'sync_status_places_downloading')
        // const locationsSyncResult: ExcelPlaceRow[] = await parseSheetsPlacesSpreadsheet(excel)
        // await statusUpdate(ctx, message, 'sync_status_saving')

        const {eventsDiff, askUserToConfirm, packsDiff, allValidatesPacks, packsErrors} = await db.tx('sync', async (dbTx) => {

            const eventsDiff = await dbTx.repoSync.prepareDiffForSync(eventsSyncResult.rawEvents, dbTx)

            const allValidatesPacks = await validatePacksForSync(packsSyncResult, getExistingIdsFrom(eventsDiff))
            const [packsValid, packsErrors] = partition(allValidatesPacks.filter(s => s.published), p => p.isValid)

            const {packsForSave, unsavedPackEventIds} = mapValidatedPacksToPacksForSave(packsValid)
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
                `deleted={${eventsDiff.deleted.map(d => d.primaryData.extId).join(',')}}`
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
        GLOBAL_SYNC_STATE.abort()
        if (e instanceof WrongExcelColumnsError) {
            await statusUpdate(ctx, message, 'sync_wrong_format', e.data)
        } else {
            await statusUpdate(ctx, message, 'sync_error', {error: e.toString().substr(0, 100)})
            logger.error(e)
        }
    }
}

export async function synchronizeDbByUser(ctx: ContextMessageUpdate): Promise<void> {
    const oldUser = GLOBAL_SYNC_STATE.lockOnSync(ctx)
    if (oldUser !== undefined) {
        await ctx.replyWithHTML(i18Msg(ctx, 'sync_is_locked',
            {user: getHumanReadableUsername(oldUser)}))
    } else {
        const statusMessage = await ctx.replyWithHTML(i18Msg(ctx, 'sync_status_step_auth', {url: getGoogleSpreadSheetURL()}), {
            disable_web_page_preview: true
        })

        setTimeout(asyncSync, 0, ctx, statusMessage)
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
        if (this.user === undefined) {
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
                logger.warn(`failed to send to admin.tid = ${admin.tid}`)
                logger.warn(e)
            }
        }
    }
}

export const GLOBAL_SYNC_STATE = new GlobalSync()

export async function replySyncNoTransaction(ctx: ContextMessageUpdate): Promise<void> {
    ctx.logger.warn(`sync already in progress (${GLOBAL_SYNC_STATE.getStatus()})`)
    await ctx.replyWithHTML(i18Msg(ctx, 'sync_no_transaction', {
        minutes: Math.ceil(SYNC_CONFIRM_TIMEOUT_SECONDS / 60),
        status: GLOBAL_SYNC_STATE.getStatus()
    }))
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
            return extIdAndMaybeId.id
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
    return {packsForSave, unsavedPackEventIds}
}

function shouldUserConfirmSync(eventsDiff: EventsSyncDiff, packsDiff: PacksSyncDiff, packsErrors: EventPackValidated[]): boolean {
    const countDangers = eventsDiff.deleted.length
        + eventsDiff.recovered
            .filter((i: EventToRecover) => i.old.title !== i.primaryData.title).length
        + packsDiff.deleted.length
        + packsDiff.deleted.length
    return countDangers > 0
}

async function replyWithHTMLMaybeChunk(ctx: ContextMessageUpdate, msg: string, extra?: ExtraReplyMessage) {
    return await chunkanize(msg, async (text, msgExtra) => await ctx.replyWithHTML(text, msgExtra), extra)
}

function listExtIds(eventToSaves: EventToSave[]): string {
    return eventToSaves.map(z => z.primaryData.extId).join(',')
}