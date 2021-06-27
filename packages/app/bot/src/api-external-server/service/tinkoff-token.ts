import sha256 from 'sha256'
import { TcsPaymentNotification } from '../interface/tcs-types'

export function calcTinkoffToken(request: TcsPaymentNotification, privateKey: string): string {
    const rWithPass: Record<string, string> = {
        ...JSON.parse(JSON.stringify(request)),
        Password: privateKey
    }
    delete rWithPass.Token

    const implode = Object.keys(rWithPass).sort().reduce((obj: string, key) => obj + rWithPass[key], '')
    return sha256(implode)
}