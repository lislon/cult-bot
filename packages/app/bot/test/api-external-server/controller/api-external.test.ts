import express from 'express'
import request from 'supertest'
import { apiExternalRouter } from '../../../src/api-external-server/controller/api-external'
import { tinkoffStatusUpdate } from '../../../src/api-external-server/service/tinkoff-service'
import { myMocked } from '../../util/jest-mock-helper'
import jsonErrorHandler from 'express-json-error-handler'
import { makeTinkoffNotification } from '../test-util/tinkoff-test-util'
import { calcTinkoffToken } from '../../../src/api-external-server/service/tinkoff-token'
import { botConfig } from '../../../src/util/bot-config'


jest.mock('../../../src/api-external-server/service/tinkoff-service')

describe('API format', () => {
    const externalApi = express().use(apiExternalRouter, jsonErrorHandler())

    test('On success 200 OK is returned', async () => {
        myMocked(tinkoffStatusUpdate).mockResolvedValue(true)

        await request(externalApi)
            .post('/tinkoff/payment-notify')
            .send(makeTinkoffNotification({
                Token: calcTinkoffToken(makeTinkoffNotification(), botConfig.BILLING_TINKOFF_PASSWORD)
            }))
            .expect(200, 'OK')
    })

    test('On error 409 CONFLICT is returned', async () => {
        myMocked(tinkoffStatusUpdate).mockResolvedValue('Oops')

        await request(externalApi)
            .post('/tinkoff/payment-notify')
            .send(makeTinkoffNotification({
                Token: calcTinkoffToken(makeTinkoffNotification(), botConfig.BILLING_TINKOFF_PASSWORD)
            }))
            .expect(409, 'Oops')
    })

    test('On bad token return 403', async () => {
        myMocked(tinkoffStatusUpdate).mockResolvedValue('Oops')

        await request(externalApi)
            .post('/tinkoff/payment-notify')
            .send(makeTinkoffNotification({
                Token: 'bad'
            }))
            .expect(403, 'BAD TOKEN')
    })

})



