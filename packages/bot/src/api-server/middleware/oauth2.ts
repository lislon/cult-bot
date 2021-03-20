import express from 'express'
import OktaJwtVerifier from '@okta/jwt-verifier'
import { NextFunction } from 'express-serve-static-core'
import { botConfig } from '../../util/bot-config'
import { logger } from '../../util/logger'

export const apiRouter = express.Router();

const oktaJwtVerifier = new OktaJwtVerifier({
    clientId: botConfig.OKTA_OAUTH2_CLIENT_ID,
    issuer: botConfig.OKTA_OAUTH2_ISSUER,
})

export async function oAuth2(req: express.Request, res: express.Response, next: NextFunction): Promise<void> {
    if (botConfig.OKTA_OAUTH2_ENABLED) {
         try {
            const {authorization} = req.headers
            if (!authorization) throw new Error('You must send an Authorization header')

            const [authType, token] = authorization.split(' ')
            if (authType !== 'Bearer') throw new Error('Expected a Bearer token')

            await oktaJwtVerifier.verifyAccessToken(token, 'api://default')
        } catch (error) {
            logger.warn(error)
            res.json({error: error.message})
        }
    }
    return next()
}