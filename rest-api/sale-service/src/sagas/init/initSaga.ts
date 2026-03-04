import RabbitClient from '~/service/utils/rabbitmq.service'
import { EventEnvelope } from '../events/envelope'
import Logger from '~/utils/logger'

// Buy VIP Domain
import vipHandler from '~/sagas/buy_vip/vip.handler'
import { VipMessageType } from '~/sagas/buy_vip/vip.events'
import { VipQueueName } from '~/sagas/buy_vip/vip.queues'
import { VipRegisterUpdatedPayload, VipRegisterFailedPayload } from '~/sagas/buy_vip/vip.dtos'

// Order Course Domain
import courseHandler from '~/sagas/order_course/course.handler'
import { CourseMessageType } from '~/sagas/order_course/course.events'
import { CourseQueueName } from '~/sagas/order_course/course.queues'
import { RegisterUpdatedPayload } from '~/sagas/order_course/course.dtos'

export async function initSagas() {
  await RabbitClient.getInstance()

  // routing key of register_service_queue is order.created.v1
  await RabbitClient.bindQueueToExchange(CourseQueueName.REGISTER_SERVICE_QUEUE, 'app_events', 'order.#', 'topic')
  await RabbitClient.bindQueueToExchange(VipQueueName.VIP_PACKAGE_REGISTER_SERVICE_QUEUE, 'app_events', 'vip.#', 'topic')
  // routing key of order_service_queue is register.updated.v1
  await RabbitClient.bindQueueToExchange(CourseQueueName.ORDER_SERVICE_QUEUE, 'app_events', 'register.#', 'topic')
  // routing key of notification_service_queue is notification.send.v1
  await RabbitClient.bindQueueToExchange(CourseQueueName.NOTIFICATION_SERVICE_QUEUE, 'app_events', 'notification.#', 'topic')

  // bind consumer for order_service_queue handling normal order events
  const orderRoutingKeys = [
    CourseMessageType.REGISTER_UPDATED,
    CourseMessageType.REGISTER_UPDATE_FAILED
  ]

  RabbitClient.registerConsumer<any>(CourseQueueName.ORDER_SERVICE_QUEUE, 'app_events', orderRoutingKeys, async (parsed) => {
    const data = parsed as EventEnvelope<any>
    if (!data.payload || !data.payload.orderId) {
      throw new Error(`Invalid payload for event ${data.type}`)
    }

    Logger.info(`[ORDER_SERVICE_QUEUE] received data ${JSON.stringify(data)}`)

    if (data.type === CourseMessageType.REGISTER_UPDATED) {
      await courseHandler.handleOrderCreated(data.payload as RegisterUpdatedPayload)
    } else if (data.type === CourseMessageType.REGISTER_UPDATE_FAILED) {
      await courseHandler.handleRegisterUpdateFailed(data.payload as RegisterUpdatedPayload)
    } else {
      Logger.warn(`Unhandled message type in ORDER_SERVICE_QUEUE: ${data.type}`)
    }
  })

  // bind consumer for vippackage.register.service.queue handling VIP events
  const vipRoutingKeys = [
    VipMessageType.VIP_REGISTER_UPDATED,
    VipMessageType.VIP_REGISTER_FAILED
  ]

  RabbitClient.registerConsumer<any>(VipQueueName.VIP_PACKAGE_REGISTER_SERVICE_QUEUE, 'app_events', vipRoutingKeys, async (parsed) => {
    const data = parsed as EventEnvelope<any>
    if (!data.payload || !data.payload.orderId) {
      throw new Error(`Invalid payload for VIP event ${data.type}`)
    }

    Logger.info(`[VIP_PACKAGE_REGISTER_SERVICE_QUEUE] received data ${JSON.stringify(data)}`)

    if (data.type === VipMessageType.VIP_REGISTER_UPDATED) {
      await vipHandler.handleVipRegisterUpdated(data.payload as VipRegisterUpdatedPayload)
    } else if (data.type === VipMessageType.VIP_REGISTER_FAILED) {
      await vipHandler.handleVipRegisterFailed(data.payload as VipRegisterFailedPayload)
    } else {
      Logger.warn(`Unhandled message type in VIP_PACKAGE_REGISTER_SERVICE_QUEUE: ${data.type}`)
    }
  })
}