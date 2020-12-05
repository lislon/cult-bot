import { config } from 'dotenv'
import { pgp } from '../database/db'

config()
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL


(async function run() {

    try {

    } finally {
        pgp.end()
    }


})()

