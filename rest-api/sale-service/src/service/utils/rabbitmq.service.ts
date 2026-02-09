import amqp, { Channel, ChannelModel } from 'amqplib'
import { QueueNameEnum } from '../../enums/emailType.enum'
import { NotificationDto } from '../../dto/request/notification.dto'
import Logger from '../../utils/logger'

const RabbitMQConf = {
  protocol: 'amqp',
  hostname: process.env.RABBIT_MQ_HOST,
  port: process.env.RABBIT_MQ_PORT,
  username: process.env.RABBIT_MQ_USER_NAME,
  password: process.env.RABBIT_MQ_PASSWORD,
  authMechanism: 'AMQPLAIN',
  vhost: '/',
  uri: process.env.RABBIT_MQ_URI || null
}

interface ConsumerDef {
  queue: string
  exchange?: string
  routingKeys?: string | string[]
  handler: (envelope: any) => Promise<void>
  exchangeType?: 'topic' | 'direct' | 'fanout'
}

class RabbitClient {
  private static instance: RabbitClient
  private static connection: ChannelModel | null = null
  private static channel: Channel | null = null
  private static isConnecting = false
  private static consumers: ConsumerDef[] = []

  private constructor() { }

  // Singleton accessor
  public static async getInstance(): Promise<RabbitClient> {
    if (!RabbitClient.instance) {
      RabbitClient.instance = new RabbitClient()
      await RabbitClient.createConnection()
    }
    return RabbitClient.instance
  }

  // Generic event handler function
  // Note: Only used internally or if specific ad-hoc consuming is needed. 
  // Prefer registerConsumer for auto-reconnection support.
  private static consumeQueue<T>(queue: QueueNameEnum, handler: (parsed: T) => Promise<void>) {
    RabbitClient.channel?.consume(queue, async (data) => {
      if (!data) return
      try {
        Logger.info(data.content.toString());
        const parsed: T & { type?: string } = JSON.parse(data.content.toString())
        parsed.type = queue

        await handler(parsed)
        RabbitClient.channel?.ack(data)
      } catch (err) {
        Logger.error(`Error processing message in queue ${queue}: ${err}`)
        RabbitClient.channel?.nack(data, false, true)
      }
    })
  }

  // Create connection and channel -> register consumers
  private static async createConnection(): Promise<void> {
    if (this.isConnecting) return
    this.isConnecting = true

    try {
      const uri = RabbitMQConf.uri || `${RabbitMQConf.protocol}://${RabbitMQConf.username}:${RabbitMQConf.password}@${RabbitMQConf.hostname}:${RabbitMQConf.port}${RabbitMQConf.vhost}`

      Logger.info('Attempting to connect to RabbitMQ...')
      RabbitClient.connection = await amqp.connect(uri)

      // Handle connection events
      RabbitClient.connection.on('error', (err) => {
        Logger.error(`RabbitMQ Connection Error: ${err}`)
      })

      RabbitClient.connection.on('close', () => {
        Logger.warn('RabbitMQ Connection Closed so re-connecting...')
        RabbitClient.connection = null
        RabbitClient.channel = null
        RabbitClient.scheduleReconnect()
      })

      RabbitClient.channel = await RabbitClient.connection.createChannel()
      RabbitClient.channel.on('error', (err) => {
        Logger.error(`RabbitMQ Channel Error: ${err}`)
      })

      if (!RabbitClient.channel) {
        throw new Error('RabbitMQ channel is not initialized')
      }

      Logger.info('Connection to RabbitMQ established and Channel created')

      // Re-setup registered consumers
      for (const consumer of RabbitClient.consumers) {
        await RabbitClient.setupConsumer(consumer)
      }

      this.isConnecting = false
    } catch (error) {
      Logger.error(`RabbitMQ connection initial failed: ${error}`)
      this.isConnecting = false
      // Retry on failure
      RabbitClient.scheduleReconnect()
    }
  }

  private static scheduleReconnect() {
    setTimeout(async () => {
      Logger.info('Reconnecting to RabbitMQ...')
      await RabbitClient.createConnection()
    }, 5000)
  }

  // Helper to actually set up the consumer on the channel
  private static async setupConsumer(consumer: ConsumerDef) {
    if (!RabbitClient.channel) return

    try {
      // Optional: Assert queue/exchange here if needed, or rely on them existing/being created elsewhere.
      // For robustness, asserting queue here is good.
      await RabbitClient.channel.assertQueue(consumer.queue, { durable: true });

      if (consumer.exchange && consumer.routingKeys) {
        const keys = Array.isArray(consumer.routingKeys) ? consumer.routingKeys : [consumer.routingKeys]
        await RabbitClient.channel.assertExchange(consumer.exchange, consumer.exchangeType || 'topic', { durable: true })
        for (const k of keys) {
          await RabbitClient.channel.bindQueue(consumer.queue, consumer.exchange, k)
        }
      }

      RabbitClient.channel.consume(
        consumer.queue,
        async (msg) => {
          if (!msg) return
          try {
            const envelope = JSON.parse(msg.content.toString())
            await consumer.handler(envelope)
            RabbitClient.channel?.ack(msg)
          } catch (err) {
            Logger.error(`Error processing message from ${consumer.queue}: ${err}`)
            RabbitClient.channel?.nack(msg, false, false)
          }
        },
        { noAck: false }
      )
      Logger.info(`Setup consumer for queue: ${consumer.queue}`)
    } catch (err) {
      Logger.error(`Failed to setup consumer ${consumer.queue}: ${err}`)
    }
  }

  // Send message to queue
  public static async sendMessage(data: NotificationDto, queueName: QueueNameEnum): Promise<boolean> {
    try {
      if (!RabbitClient.channel) {
        Logger.error('RabbitMQ channel is not initialized, cannot send message')
        return false // Or throw, but returning false is safer if we don't want to crash request
      }

      await RabbitClient.channel.assertQueue(queueName, { durable: true })

      const msgBuffer = Buffer.from(JSON.stringify(data))
      const sent = RabbitClient.channel.sendToQueue(queueName, msgBuffer)
      Logger.info('Message sent to RabbitMQ')
      return sent
    } catch (error) {
      Logger.error(`Failed to send message: ${error}`)
      return false
    }
  }

  // Publish message to an exchange
  public static async sendMessageTopic(
    data: any,
    exchange: string,
    routingKey = '',
    exchangeType: 'topic' | 'direct' | 'fanout' = 'topic',
    persistent = true
  ): Promise<boolean> {
    try {
      if (!RabbitClient.channel) {
        Logger.error('RabbitMQ channel is not initialized, cannot publish message')
        return false
      }

      await RabbitClient.channel.assertExchange(exchange, exchangeType, { durable: true })

      const payload = Buffer.from(JSON.stringify(data))
      const published = RabbitClient.channel.publish(exchange, routingKey, payload, { persistent })
      Logger.info(`Message published to exchange ${exchange} with routingKey '${routingKey}'`)
      return published
    } catch (error) {
      Logger.error(`Failed to publish message to exchange: ${error}`)
      return false
    }
  }

  // Ensure exchange + queue exist and bind routing keys
  public static async bindQueueToExchange(
    queue: string,
    exchange: string,
    routingKeys: string | string[],
    exchangeType: 'topic' | 'direct' | 'fanout' = 'topic'
  ): Promise<void> {
    if (!RabbitClient.channel) {
      Logger.warn(`Cannot bind ${queue} to ${exchange}, channel not ready`)
      return
    }
    const keys = Array.isArray(routingKeys) ? routingKeys : [routingKeys]
    await RabbitClient.channel.assertExchange(exchange, exchangeType, { durable: true })
    await RabbitClient.channel.assertQueue(queue, { durable: true })
    for (const k of keys) {
      await RabbitClient.channel.bindQueue(queue, exchange, k)
    }
    Logger.info(`Bound queue ${queue} -> ${exchange} [${keys.join(',')}]`)
  }

  // Register consumer: store definition and setup
  public static async registerConsumer<T = any>(
    queue: string,
    exchange: string,
    routingKeys: string | string[],
    handler: (envelope: { type: string; version?: string; correlationId?: string; payload: T }) => Promise<void>,
    exchangeType: 'topic' | 'direct' | 'fanout' = 'topic'
  ): Promise<void> {

    const consumer: ConsumerDef = {
      queue,
      exchange: exchange, // Explicitly passed
      routingKeys: routingKeys,
      handler,
      exchangeType
    }

    RabbitClient.consumers.push(consumer)

    if (RabbitClient.channel) {
      await RabbitClient.setupConsumer(consumer)
    } else {
      Logger.warn(`Channel not ready for ${queue}, will register on connect`)
    }
  }
}

export default RabbitClient