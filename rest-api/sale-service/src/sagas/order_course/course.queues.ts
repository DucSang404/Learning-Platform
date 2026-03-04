export const CourseQueueName = {
    REGISTER_SERVICE_QUEUE: 'register.service.queue',
    ORDER_SERVICE_QUEUE: 'order.service.queue',
    NOTIFICATION_SERVICE_QUEUE: 'notification.service.queue.dev'
} as const

export type CourseQueueNameKey = keyof typeof CourseQueueName
