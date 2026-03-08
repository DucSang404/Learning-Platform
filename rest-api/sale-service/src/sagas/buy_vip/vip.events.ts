export const VipMessageType = {
    VIP_REGISTER_CREATED: 'vip.register.created.v1',
    VIP_REGISTER_UPDATED: 'vip.register.updated.v1',
    VIP_REGISTER_FAILED: 'vip.register.failed.v1',
    NOTIFICATION_SEND: 'notification.send.v1'
} as const

export type VipMessageTypeKey = keyof typeof VipMessageType

export const VipExchangeNames = {
    APP_EVENTS: 'app_events'
} as const
