export interface OrderItemDto {
  course_id: string
  price: number
}

export interface OrderCreatedPayload {
  correlationId?: string
  orderId: string
  userId: string
  amount: number
  items: OrderItemDto[]
}

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

export interface RegisterUpdatedPayload {
  orderId: string
}

export interface OrderCompletedPayload {
  correlationId?: string
  orderId: string
}

export interface NotificationPayload {
  orderId: string
  to: string
  subject: string
  body: string
}
