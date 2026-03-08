import { NotificationPayload } from '../order/dtos'
import nodeMailService from '~/services/mails/nodemail.service'
import { OrderConfirm } from '~/dto/request/notification.dto'
import { QueueNameEnum } from '~/enums/rabbitQueue.enum'
import chatService from '~/services/chat.service'
import Logger from '~/utils/logger'


class NotificationHandler {
  // Process when receiving event register.created.v1 -> save order with status Completed
  async handleSendEmailConfirm(message: NotificationPayload) {
    try {
      Logger.info(`[NotificationHandler] Received email confirmation request for ${message.customer_email}. Items: ${message.items?.length}. Type: ${(message as any).orderType}`);
      const notification = {
        type: QueueNameEnum.ORDERCONFIRM,
        email: message.customer_email,
        title: 'Xác nhận đơn hàng',
        payload: message
      } as OrderConfirm
      // Run sendMail and per-item chat sends in parallel, await all
      await Promise.all([
        nodeMailService.sendMail(notification),
        ...message.items.map((item) =>
          chatService.sendFirstMessage(item.course_name, item.instructor_id, message.user_id)
        ),
      ])
    } catch (error) {
      Logger.error(`Error handling order created notification: ${error}`)
    }
  }
}

export default new NotificationHandler()
