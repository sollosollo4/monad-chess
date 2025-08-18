import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/log';

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const traceId = req.headers['x-request-id'];

  logger.info(`⬅️ ${req.method} ${req.originalUrl} | query=${JSON.stringify(req.query)} | body=${JSON.stringify(req.body)} | traceId=${traceId}`);

  const originalJson = res.json;

  res.json = function (body: any) {
    const duration = Date.now() - start;
    logger.info(`➡️ ${req.method} ${req.originalUrl} | status=${res.statusCode} | duration=${duration}ms | response=${JSON.stringify(body)} | traceId=${traceId}`);
    return originalJson.call(this, body);
  };

  next();
};
