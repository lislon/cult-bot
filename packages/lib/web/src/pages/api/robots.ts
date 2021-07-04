import type { NextApiRequest, NextApiResponse } from 'next'
import { appConfig } from '@/src/lib/app-config'

export default function handler(
    req: NextApiRequest,
    res: NextApiResponse<string>
): void {
    if (appConfig.isProduction) {
        res.send([
            `User-agent: *`,
            `Disallow: /pay`,
            `Disallow: /oferta`,
        ].join('\n'))
    } else {
        res.send([
            `User-agent: *`,
            `Disallow: /`,
        ].join('\n'))
    }
}
