import { VipRegisterUpdatedPayload, VipRegisterFailedPayload } from './vip.dtos';
import prismaService from '~/service/utils/prisma.service';
import { OrderStatus } from '@prisma/client';
import rabbitMQService from '~/service/utils/rabbitmq.service';
import { createEnvelope } from '../events/envelope';
import { VipMessageType, VipExchangeNames } from './vip.events';
import orderService from '~/service/models/order.service';
import redisService from '~/service/utils/redis.service';
import Logger from '~/utils/logger';

class VipHandler {
    private async sendMessage(type: string, payload: any, correlationId: string) {
        const envelope = createEnvelope({ type, payload, correlationId });
        await rabbitMQService.sendMessageTopic(envelope, VipExchangeNames.APP_EVENTS, type, 'topic', true).catch(err => {
            Logger.error(`Failed to send message [${type}]: ${err}`);
        });
    }

    async handleVipRegisterUpdated(message: VipRegisterUpdatedPayload) {
        try {
            const order = await prismaService.$transaction(async (tx) => {
                const order = await tx.order.findFirst({ where: { id: message.orderId } });
                if (!order) throw new Error('VIP Order not found');
                await tx.order.update({ where: { id: message.orderId }, data: { status: OrderStatus.Completed } });
                return order;
            });

            // Unblock the VIP payment handler waiting on Redis
            await redisService.publishSagaResult(message.orderId, { success: true });

            Logger.info(`Successfully completed VIP order: ${message.orderId}`);

            // Fire-and-forget: notification failure should NOT trigger rollback
            orderService.getOrderInfo(order.user_id, message.orderId)
                .then(orderData => this.sendMessage(
                    VipMessageType.NOTIFICATION_SEND,
                    { ...orderData, orderType: 'VIP' },
                    `viporder-${order.id}`
                ))
                .catch(err => Logger.error(`Failed to send VIP notification for order ${message.orderId}: ${err}`));

        } catch (error) {
            Logger.error(`Error completing VIP order: ${error}`);
            await Promise.all([
                redisService.publishSagaResult(message.orderId, { success: false, reason: String(error) }),
                prismaService.order.update({ where: { id: message.orderId }, data: { status: OrderStatus.Cancel } }).catch(() => { }),
                this.sendMessage(
                    VipMessageType.VIP_REGISTER_FAILED,
                    {
                        orderId: message.orderId,
                        userId: message.userId,
                        status: 'FAILED',
                        reason: String(error)
                    } satisfies VipRegisterFailedPayload,
                    `viporder-${message.orderId}`
                )
            ]);
        }
    }

    async handleVipRegisterFailed(message: VipRegisterFailedPayload) {
        Logger.error(`VIP Register update failed for order ${message.orderId}: ${message.reason || message.status}`);
        await prismaService.order.update({ where: { id: message.orderId }, data: { status: OrderStatus.Cancel } });
    }
}

export default new VipHandler();
