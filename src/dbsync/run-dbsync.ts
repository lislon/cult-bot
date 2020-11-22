import dbsync from './dbsync'
import { db, pgp } from '../database/db'

(async function run() {
    await dbsync(db)
    pgp.end()
})()

