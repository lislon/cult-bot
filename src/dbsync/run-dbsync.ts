import dbsync from './dbsync'
import { pgp } from '../db'

(async function run() {
    await dbsync()
    pgp.end()
})()

