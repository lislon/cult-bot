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
            await dbTx.none('TRUNCATE cb_events_snapshot')
            await dbTx.none('TRUNCATE cb_events_snapshot_meta')
            const columns = [
                'id' +
                'title',
                'category',
                'place',
                'address',
                'timetable',
                'duration',
                'price',
                'notes',
                'description',
                'url',
                'tag_level_1',
                'tag_level_2',
                'tag_level_3',
                'rating',
                'reviewer',
                'is_anytime',
                'geotag',
                'ext_id',
                'created_at'
            ]
            await dbTx.none(`INSERT INTO cb_events_snapshot (${columns.join(', ')}) (SELECT ${columns.join(', ')} FROM cb_events cb WHERE cb.deleted_at IS NULL)`)
            await dbTx.none(this.pgp.helpers.insert({
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

