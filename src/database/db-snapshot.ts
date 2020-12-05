import { Event } from '../interfaces/app-interfaces'
import { db, IExtensions } from './db'
import { IDatabase, IMain, ITask } from 'pg-promise'

export interface SnapshotDiff {
    added: Event[]
    removed: Event[]
    modified: EventModifiedDiff[]
}

export interface EventModifiedDiff {
    latest: Event
    oldest: Event
}

export class SnapshotRepository {
    constructor(private db: IDatabase<any>, private pgp: IMain) {
    }

    async takeSnapshot(): Promise<void> {
        await this.db.tx(async (dbTx: ITask<IExtensions> & IExtensions) => {
            await db.none('DELETE FROM cb_events_snapshot')
            await db.none('INSERT INTO cb_events_snapshot (SELECT * FROM cb_events)')
        })
    }

    async diff(): Promise<void> {
        // const columns = EventsSyncRepository.columns
        //     .filter(c => c !== 'order_rnd')
        //     .join(',')
        //
        // await this.db.tx(async (dbTx: ITask<IExtensions> & IExtensions) => {
        //     const rows = await db.manyOrNone(`SELECT ext_id, MD5(CAST((${columns})AS text)) FROM cb_events cbe`)
        //     console.log(rows)
        // })
    }
}

