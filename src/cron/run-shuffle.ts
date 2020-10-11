import { db, pgp } from '../db'

(async function run() {
    console.log('Shuffle events...')
    await db.none('update cb_events set order_rnd = CEIL(random() * 1000000)')
    console.log('Success!')
    pgp.end()
})()

