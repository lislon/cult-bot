import express from 'express'
import { tinkoffStatusUpdate } from '../service/tinkoff-service'
import { calcTinkoffToken } from '../service/tinkoff-token'
import { botConfig } from '../../util/bot-config'
import asyncHandler from 'express-async-handler'

export const apiExternalRouter = express.Router()

apiExternalRouter.use(express.json())

apiExternalRouter.post('/tinkoff/payment-notify', asyncHandler(async (req, res) => {
    if (req.body.Token === calcTinkoffToken(req.body, botConfig.BILLING_TINKOFF_PASSWORD) || !botConfig.BILLING_TINKOFF_PASSWORD_ENABLED) {
        const result = await tinkoffStatusUpdate(req.body)
        if (result === true) {
            res.status(200).send('OK')
        } else {
            res.status(409).send(result)
        }
    } else {
        res.status(403).send('BAD TOKEN')
    }
}))
