export interface VipRegisterCreatedPayload {
    correlationId?: string
    orderId: string
    userId: string
    amount: number
    durationMonths: number
}

export interface VipRegisterUpdatedPayload {
    orderId: string
    userId: string
    status: string
}

export interface VipRegisterFailedPayload {
    orderId: string
    userId: string
    status: string
    reason: string
}
