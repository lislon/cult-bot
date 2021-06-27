import { TcsPaymentNotification } from '../interface/tcs-types'
import { db } from '../../database/db'
import { Payment } from '../../database/db-billing'

export type TransactionStatusUpdateResult = true | string

function verifyPayment(req: TcsPaymentNotification, payment: Payment): TransactionStatusUpdateResult {
    if (payment.paidAt !== undefined) {
        return `Order '${req.OrderId}' already paid at ${payment.paidAt}`
    }
    if (payment.refundedAt !== undefined) {
        return `Order '${req.OrderId}' already refundedAt at ${payment.paidAt}`
    }
    if (+payment.amount !== req.Amount) {
        return `Payment amount mismatch. (Paid ${req.Amount}, but should ${payment.amount})`
    }
    return true
}


export const tinkoffStatusUpdate = async (req: TcsPaymentNotification, now: Date = new Date()): Promise<TransactionStatusUpdateResult> => {
    await db.repoBilling.savePaymentNotification(req)

    const payment = await db.repoBilling.getPayment(+req.OrderId)
    if (payment === undefined) {
        return `Order '${req.OrderId}' is not found`
    }

    const isOkToPayOrError = verifyPayment(req, payment)

    if (req.Status === 'AUTHORIZED') {
        return isOkToPayOrError
    } else if (req.Status === 'CONFIRMED') {
        if (isOkToPayOrError !== true) {
            return isOkToPayOrError
        }

        await db.repoBilling.updatePayment({
            id: payment.id,
            paidAt: now
        })

        await db.repoSubscription.updateSubscription({
            subscriptionId: payment.subscriptionId,
            activatedAt: now
        })
    } else if (req.Status === 'REJECTED') {
        await db.repoBilling.updatePayment({
            id: payment.id,
            rejectedAt: now
        })
    } else if (req.Status === 'REFUNDED') {
        await db.repoBilling.updatePayment({
            id: payment.id,
            refundedAt: now
        })
    }
    return true
}