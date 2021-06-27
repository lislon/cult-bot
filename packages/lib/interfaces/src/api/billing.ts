export interface CreatePaymentRequest {
    token: string
}

export interface CreatePaymentResponse {
    paymentId: number
    amount: number
    description: string
}