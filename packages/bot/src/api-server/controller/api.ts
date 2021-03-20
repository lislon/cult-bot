import express from 'express'
import { findMatchingEvents } from '../service/service'
import { FindMatchingEventRequest } from '@culthub/interfaces'

export const apiRouter = express.Router();

apiRouter.use(express.json())

apiRouter.post('/find-matching', async (req, res) => {
    const r: FindMatchingEventRequest = req.body
    const matchingEvent = await findMatchingEvents(r)
    res.json(matchingEvent)
})
