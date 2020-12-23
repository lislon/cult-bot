import { db, pgp } from '../database/db'
import { logger } from '../util/logger'
import { authToExcel } from './googlesheets'
import { eventPacksEnrichWithIds, getOnlyValid, prepareForPacksSync } from './packsSyncLogic'
import { sheets_v4 } from 'googleapis'
import { Dictionary, keyBy } from 'lodash'
import { ExtIdAndId } from '../interfaces/app-interfaces'
import Sheets = sheets_v4.Sheets

(async function run() {
    try {
        logger.debug('Connection from excel...')
        const excel: Sheets = await authToExcel()
        const existingIds = await db.repoPacks.fetchAllIdsExtIds()
        const idByExtId: Dictionary<ExtIdAndId> = keyBy(existingIds, 'extId')
        const validationResult = await prepareForPacksSync(excel, idByExtId)
        await db.repoPacks.sync(eventPacksEnrichWithIds(getOnlyValid(validationResult), idByExtId))
    } catch (e) {
        logger.error(e);
    }
    // console.log(q.errorsUnresolved)
    pgp.end()
})()

