// src/middleware/errorHandler.ts
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/log';

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const isDev = process.env.NODE_ENV !== 'production';
  const traceId = req.headers['x-request-id'];

  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';

  logger.error({
    message,
    traceId,
    stack: err.stack,
    context: 'errorHandler'
  });

  res.status(status).json({
    error: {
      message,
      ...(isDev && { stack: err.stack })
    }
  });
};
