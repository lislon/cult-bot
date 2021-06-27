import { db, IExtensions } from '../../database/db'
import { CreatePaymentRequest, CreatePaymentResponse } from '@culthub/interfaces'
import { decodeBillToken } from '../../lib/subscription/subscription'
import { ITask } from 'pg-promise'

async function createNewUnpaidPayment(dbTx: ITask<IExtensions> & IExtensions, userId: number, days: number, amount: number, createdAt: Date): Promise<number> {
    const subscriptionId = await dbTx.repoSubscription.createSubscription({
        userId,
        periodDays: days,
        createdAt: createdAt,
    })

    return await dbTx.repoBilling.createUnpaidPayment({
        amount,
        subscriptionId,
        userId
    })
}

export async function createBill(req: CreatePaymentRequest, priceGenerator: () => number, now: Date = new Date()): Promise<CreatePaymentResponse> {
    const {userId, days} = decodeBillToken(req.token)
    const amount = priceGenerator()

    return await db.tx(async dbTx => {
        const existingPaymentId = await db.repoBilling.findUnpaidSubscription({
            amount, days, userId
        })
        return {
            paymentId: existingPaymentId ? existingPaymentId : await createNewUnpaidPayment(dbTx, userId, days, amount, now),
            amount,
            description: 'Оплата'
        }
    })
}