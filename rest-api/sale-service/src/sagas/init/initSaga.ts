import RabbitClient from '~/service/utils/rabbitmq.service'
import { MessageType } from '~/sagas/order/events'
import { QueueName } from '~/sagas/order/queues'
import orderHandler from '~/sagas/handler/order.handler'
import { RegisterUpdatedPayload, VipRegisterUpdatedPayload, VipRegisterFailedPayload } from '../order/dtos'
import { EventEnvelope } from '../events/envelope'
import Logger from '~/utils/logger'

export async function initSagas() {
  await RabbitClient.getInstance()

  // routing key of register_service_queue is order.created.v1
  await RabbitClient.bindQueueToExchange(QueueName.REGISTER_SERVICE_QUEUE, 'app_events', 'order.#', 'topic')
  await RabbitClient.bindQueueToExchange(QueueName.VIP_PACKAGE_REGISTER_SERVICE_QUEUE, 'app_events', 'vip.#', 'topic')
  // routing key of order_service_queue is register.updated.v1 and vip.register.updated.v1
  await RabbitClient.bindQueueToExchange(QueueName.ORDER_SERVICE_QUEUE, 'app_events', 'register.#', 'topic')
  await RabbitClient.bindQueueToExchange(QueueName.ORDER_SERVICE_QUEUE, 'app_events', 'vip.#', 'topic')
  // routing key of notification_service_queue is notification.send.v1
  await RabbitClient.bindQueueToExchange(QueueName.NOTIFICATION_SERVICE_QUEUE, 'app_events', 'notification.#', 'topic')

  // bind single consumer for order_service_queue handling all order/vip events
  const orderRoutingKeys = [
    MessageType.REGISTER_UPDATED,
    MessageType.REGISTER_UPDATE_FAILED,
    MessageType.VIP_REGISTER_UPDATED,
    MessageType.VIP_REGISTER_FAILED
  ]

  RabbitClient.registerConsumer<any>(QueueName.ORDER_SERVICE_QUEUE, 'app_events', orderRoutingKeys, async (parsed) => {
    const data = parsed as EventEnvelope<any>
    if (!data.payload || !data.payload.orderId) {
      throw new Error(`Invalid payload for event ${data.type}`)
    }

    Logger.info(`data ${JSON.stringify(data)}`)

    if (data.type === MessageType.REGISTER_UPDATED) {
      await orderHandler.handleOrderCreated(data.payload as RegisterUpdatedPayload)
    } else if (data.type === MessageType.REGISTER_UPDATE_FAILED) {
      await orderHandler.handleRegisterUpdateFailed(data.payload as RegisterUpdatedPayload)
    } else if (data.type === MessageType.VIP_REGISTER_UPDATED) {
      await orderHandler.handleVipRegisterUpdated(data.payload as VipRegisterUpdatedPayload)
    } else if (data.type === MessageType.VIP_REGISTER_FAILED) {
      await orderHandler.handleVipRegisterFailed(data.payload as VipRegisterFailedPayload)
    } else {
      Logger.warn(`Unhandled message type in ORDER_SERVICE_QUEUE: ${data.type}`)
    }
  })
}