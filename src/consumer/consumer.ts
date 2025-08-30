import { connectRabbit } from '../rabbitmq/client';
import { ConsumeMessage } from 'amqplib';
import { logger } from '../utils/log';
import AnalyzeService from '../services/analyze';
const QUEUE_NAME = 'chess_ai_analyze';

const RETRY_LIMIT = 10;
const RETRY_DELAY_MS = 5000;

export const startConsumer = async () => {
  let retries = RETRY_LIMIT;

  while (retries > 0) {
    try {
      const channel = await connectRabbit();

      await channel.assertQueue(QUEUE_NAME, { durable: true });

      channel.consume(
        QUEUE_NAME,
        async (msg: ConsumeMessage | null) => {
          if (!msg) return;
          try {
            const content = JSON.parse(msg.content.toString());
            logger.info(`Consumer message: ${msg.content.toString()}`);
            await AnalyzeService.analyzeEventHandler(content);

            channel.ack(msg);
          } catch (error) {
            logger.error(`[Consumer] Failed to process message  ${error}`);
            channel.ack(msg);
          }
        },
        { noAck: false }
      );

      logger.info('[RabbitMQ] Consumer started');
      return;
    } catch (err) {
      const message = (err as Error).message || '';
      logger.error(`[RabbitMQ] Consumer init failed: ${message}`);

      if (/NOT_FOUND/.test(message) || /Channel closed/.test(message)) {
        retries--;
        logger.warn(`[RabbitMQ] Retry left: ${retries}. Waiting ${RETRY_DELAY_MS / 1000}s...`);
        await new Promise((res) => setTimeout(res, RETRY_DELAY_MS));
      } else {
        throw err;
      }
    }
  }

  throw new Error('[RabbitMQ] Consumer failed to start after retries');
};