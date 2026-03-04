import { VipRegisterUpdatedPayload, VipRegisterFailedPayload } from './vip.dtos';
import prismaService from '~/service/utils/prisma.service';
import { OrderStatus } from '@prisma/client';
import rabbitMQService from '~/service/utils/rabbitmq.service';
import { createEnvelope } from '../events/envelope';
import { VipMessageType, VipExchangeNames } from './vip.events';
import orderService from '~/service/models/order.service';
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
            const order = await prismaService.order.findFirst({ where: { id: message.orderId } });
            if (!order) throw new Error('VIP Order not found');

            await prismaService.order.update({ where: { id: message.orderId }, data: { status: OrderStatus.Completed } });

            const orderData = await orderService.getOrderInfo(order.user_id, message.orderId);

            await this.sendMessage(
                VipMessageType.NOTIFICATION_SEND,
                { ...orderData, orderType: 'VIP' },
                `viporder-${order.id}`
            );

            Logger.info(`Successfully completed VIP order: ${message.orderId}`);
        } catch (error) {
            Logger.error(`Error completing VIP order: ${error}`);
            await prismaService.order.update({ where: { id: message.orderId }, data: { status: OrderStatus.Cancel } }).catch(() => { });
        }
    }

    async handleVipRegisterFailed(message: VipRegisterFailedPayload) {
        Logger.error(`VIP Register update failed for order ${message.orderId}: ${message.reason || message.status}`);
        await prismaService.order.update({ where: { id: message.orderId }, data: { status: OrderStatus.Cancel } });
    }
}

export default new VipHandler();
