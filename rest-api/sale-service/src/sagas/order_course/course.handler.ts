import { RegisterUpdatedPayload } from './course.dtos';
import prismaService from '~/service/utils/prisma.service'
import { OrderStatus } from '@prisma/client';
import rabbitMQService from '~/service/utils/rabbitmq.service';
import { createEnvelope } from '../events/envelope';
import { CourseMessageType, CourseExchangeNames } from './course.events';
import orderService from '~/service/models/order.service';
import cartService from '~/service/models/cart.service';
import Logger from '~/utils/logger';

class CourseHandler {
    private async sendMessage(type: string, payload: any, correlationId: string) {
        const envelope = createEnvelope({ type, payload, correlationId });
        await rabbitMQService.sendMessageTopic(envelope, CourseExchangeNames.APP_EVENTS, type, 'topic', true).catch(err => {
            Logger.error(`Failed to send message [${type}]: ${err}`);
        });
    }

    async handleOrderCreated(message: RegisterUpdatedPayload) {
        try {
            const order = await prismaService.order.findFirst({ where: { id: message.orderId } });
            if (!order) throw new Error('Order not found');

            await prismaService.order.update({ where: { id: message.orderId }, data: { status: OrderStatus.Completed } });

            const orderData = await orderService.getOrderInfo(order.user_id, message.orderId)

            await this.sendMessage(
                CourseMessageType.NOTIFICATION_SEND,
                { ...orderData, orderType: 'COURSE' },
                `order-${order.id}`
            );

            orderData.items.forEach(async (item) => {
                cartService.removeFromCart(await cartService.getCartId(orderData.user_id), item.course_id.toString()).catch(err => {
                    Logger.error(`Failed to remove order items from cart: ${err}`);
                });
            });

            Logger.info(`Successfully completed order: ${message.orderId}`);

        } catch (error) {
            Logger.error(`Error completing order, rolling back: ${error}`);

            const order = await prismaService.order.findFirst({
                where: { id: message.orderId },
                select: { id: true, user_id: true, total: true, items: { select: { course_id: true, price: true } } }
            });

            await this.sendMessage(
                CourseMessageType.ORDER_COMPLETION_FAILED,
                {
                    orderId: order?.id,
                    userId: order?.user_id,
                    amount: order?.total,
                    items: order?.items.map(item => ({ course_id: item.course_id, price: item.price }))
                },
                `order-${order?.id}`
            );
        }
    }

    async handleRegisterUpdateFailed(message: RegisterUpdatedPayload) {
        Logger.error(`Register update failed for order: ${message.orderId}`);
        await prismaService.order.update({ where: { id: message.orderId }, data: { status: OrderStatus.Cancel } });
    }
}

export default new CourseHandler();
