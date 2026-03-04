export const VipQueueName = {
    NOTIFICATION_SERVICE_QUEUE: 'notification.service.queue.dev',
    VIP_PACKAGE_REGISTER_SERVICE_QUEUE: 'vippackage.register.service.queue'
} as const

export type VipQueueNameKey = keyof typeof VipQueueName
