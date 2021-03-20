/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextFunction, Router } from 'express'
import swaggerUi from 'swagger-ui-express'
import YAML from 'yamljs'
import path from 'path'

const swaggerDocument = YAML.load(path.resolve(__dirname, './openapi.yaml'))

const options = {
    explorer: true,
    oauth: {
        clientId: process.env.OAUTH_CLIENT_ID,
        clientSecret: process.env.OAUTH_CLIENT_SECRET,
        realm: "default",
        appName: "cult-hub-bot-dev",
        scopeSeparator: ",",
        additionalQueryStringParams: {},
        usePkceWithAuthorizationCodeGrant: true
    }
}

export const swaggerMiddleware = Router()

// swaggerMiddleware.use('/api-docs', swaggerUi.serve)

swaggerMiddleware.use('/api-docs', (req: any, res: unknown, next: NextFunction) => {
        swaggerDocument.host = req.get('host')
        req.swaggerDoc = swaggerDocument
        next()
    },
    swaggerUi.serve,
    swaggerUi.setup(undefined, {}, options)
)