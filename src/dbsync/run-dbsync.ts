import dbsync from './dbsync'
import { db, pgp } from '../db'

(async function run() {
    await dbsync(db)
    pgp.end()
})()

