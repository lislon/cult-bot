import { IncomingMessage, ServerResponse } from 'http'
import next from 'next'
import express, { Router } from 'express'
import path from 'path'


export async function siteRouter(): Promise<Router> {
    const app = next({
        dev: process.env.NODE_ENV !== 'production',
        dir: path.resolve(__dirname, '../../../../../lib/web')
    })
    const handle = app.getRequestHandler()
    await app.prepare()
    return express.Router()
        .use((async (req: IncomingMessage, res: ServerResponse) => {
            await handle(req, res)
        }))
}




