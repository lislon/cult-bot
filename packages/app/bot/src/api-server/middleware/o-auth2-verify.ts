import express from 'express'
import OktaJwtVerifier from '@okta/jwt-verifier'
import { botConfig } from '../../util/bot-config'
import { logger } from '../../util/logger'

export const apiRouter = express.Router()

const oktaJwtVerifier = new OktaJwtVerifier({
    clientId: botConfig.OKTA_OAUTH2_CLIENT_ID,
    issuer: botConfig.OKTA_OAUTH2_ISSUER,
})

export async function OAuth2Verify(req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> {
    if (botConfig.OKTA_OAUTH2_ENABLED) {
        try {
            const {authorization} = req.headers
            if (!authorization) {
                logger.warn('You must send an Authorization header')
                res.status(401).json({error: 'You must send an Authorization header'})
                return
            }

            const [authType, token] = authorization.split(' ')
            if (authType !== 'Bearer') {
                logger.warn('Expected a Bearer token')
                res.status(401).json({error: 'Expected a Bearer token'})
                return
            }

            await oktaJwtVerifier.verifyAccessToken(token, 'api://default')
        } catch (error) {
            logger.warn(error)
            res.status(403).json({error: error.message})
        }
    }
    return next()
}