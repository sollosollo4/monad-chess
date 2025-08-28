import amqplib, { Channel, Connection } from 'amqplib';
import { ENV } from '../config/env';
import { logger } from '../utils/log';

let connection: Connection | null = null;
let channel: Channel | null = null;
const RECONNECT_INTERVAL = 5000;

const QUEUE_NAME = 'chess_ai_analyze';

async function createConnection(): Promise<Channel> {
  while (true) {
    try {
      connection = await amqplib.connect(ENV.rabbitmq_host);
      channel = await connection.createChannel();

      logger.info(`[RabbitMQ] Connected confirmed`);

      connection.on('error', (err: any) => {
        logger.error(`[RabbitMQ] Connection error: ${err.message}`);
        connection = null;
        channel = null;
      });

      connection.on('close', () => {
        logger.warn('[RabbitMQ] Connection closed');
        connection = null;
        channel = null;
      });

      // graceful shutdown
      process.once('SIGINT', async () => {
        logger.info('[RabbitMQ] Closing connection...');
        await connection?.close();
        process.exit(0);
      });

      return channel;
    } catch (err) {
      logger.error(`[RabbitMQ] Failed to connect: ${(err as Error).message}`);
      await new Promise((res) => setTimeout(res, RECONNECT_INTERVAL));
    }
  }
}

export const connectRabbit = async () => {
  if (channel) return channel;
  return await createConnection();
};

export function getChannel(): amqplib.Channel {
  if (!channel) throw new Error('RabbitMQ not connected');
  return channel;
}

export const sendEvent = (event: any) => {
  if (!channel) throw new Error('RabbitMQ not initialized');

  const payload = Buffer.from(JSON.stringify(event));
  channel.sendToQueue(QUEUE_NAME, payload);

  logger.info(`[RabbitMQ] Event published to '${QUEUE_NAME}'`);
};