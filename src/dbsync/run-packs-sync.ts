import { db, pgp } from '../database/db'
import { logger } from '../util/logger'
import { authToExcel } from './googlesheets'
import { getOnlyValid, prepareForPacksSync } from './packsSyncLogic'
import { sheets_v4 } from 'googleapis'
import Sheets = sheets_v4.Sheets

(async function run() {
    try {
        logger.debug('Connection from excel...')
        const excel: Sheets = await authToExcel()
        const validationResult = await prepareForPacksSync(excel)
        await db.repoPacks.sync(getOnlyValid(validationResult))
    } catch (e) {
        logger.error(e);
    }
    // console.log(q.errorsUnresolved)
    pgp.end()
})()

