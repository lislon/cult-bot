import { TcsPaymentNotification } from '../../../src/api-external-server/interface/tcs-types'

export function makeTinkoffNotification(partial: Partial<TcsPaymentNotification> = {}): TcsPaymentNotification {
    return {
        TerminalKey: '1510572937960',
        OrderId: '123',
        Success: true,
        Status: 'CONFIRMED',
        PaymentId: 2006896,
        ErrorCode: '0',
        Amount: 102120,
        CardId: 867911,
        Pan: '430000**0777',
        ExpDate: '1122',
        Token: 'd0815e288f121255d5d6b77831fb486cc5e9f91914a3f58a99b6118b54676d84',
        ...partial,
    }
}