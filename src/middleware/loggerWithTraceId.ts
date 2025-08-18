import { v4 as uuidv4 } from 'uuid';
import { setTraceId, clearTraceId } from '../utils/log';
import { Request, Response, NextFunction } from 'express';

export const attachTraceId = (req: Request, res: Response, next: NextFunction) => {

  let traceId = req.headers['x-request-id'];
  
  if (Array.isArray(traceId)) {
    traceId = traceId[0];
  }
  if (!traceId) {
    traceId = uuidv4();
  }

  setTraceId(traceId);

  res.on('finish', () => {
    clearTraceId();
  });

  next();
};

