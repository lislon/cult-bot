import { db, IExtensions } from './db'
import { IDatabase, IMain, ITask } from 'pg-promise'

export interface SnapshotMeta {
    createdBy: string,
    createdAt: Date
}

export class SnapshotRepository {
    constructor(private db: IDatabase<any>, private pgp: IMain) {
    }

    async takeSnapshot(createdBy: string, date: Date): Promise<void> {
        await this.db.tx(async (dbTx: ITask<IExtensions> & IExtensions) => {
            await db.none('DELETE FROM cb_events_snapshot')
            await db.none('DELETE FROM cb_events_snapshot_meta')
            await db.none('INSERT INTO cb_events_snapshot (SELECT * FROM cb_events)')
            await db.none(this.pgp.helpers.insert({
                created_by: createdBy,
                created_at: date
            }, undefined, 'cb_events_snapshot_meta'))
        })
    }

    async getSnapshotMeta(): Promise<SnapshotMeta> {
        return db.oneOrNone('SELECT * FROM cb_events_snapshot_meta', undefined, (r) => {
            return r ? {
                createdBy: r.created_by,
                createdAt: r.created_at
            } : undefined
        })
    }
}

