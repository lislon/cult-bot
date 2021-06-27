import { botConfig } from '../../util/bot-config'

export interface BillableInfo {
    userId: number
    days: number
}

export function encodeBillToken({userId, days}: BillableInfo): string {
    return `${userId}:${days}`
    // return Buffer.from(`${userId}:${days}`, 'utf8').toString('base64');
}

export function decodeBillToken(base64: string): BillableInfo {
    // const [userId, days] = Buffer.from(base64, 'base64').toString().split(':')
    const [userId, days] = base64.split(':')
    return {userId: +userId, days: +days}
}

export function generatePaymentUrl(billableInfo: BillableInfo): string {
    return `${botConfig.SITE_URL}/pay/${encodeBillToken(billableInfo)}`
}