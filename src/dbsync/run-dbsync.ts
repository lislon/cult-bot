import dbsync from './dbsync'
import { db, pgp } from '../db/db'

(async function run() {
    await dbsync(db)
    pgp.end()
})()

