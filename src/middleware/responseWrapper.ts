import { Request, Response, NextFunction } from 'express';

export const responseWrapper = (req: any, res: any, next: any) => {
  const traceId = req.headers['x-request-id'];

  res.success = (data: any, meta: Record<string, any> = {}) => {
    res.status(200).json({
      success: true,
      data,
      error: null,
      meta: {
        traceId,
        timestamp: new Date().toISOString(),
        ...meta
      }
    });
  };

  res.fail = (
    code: string,
    message: string,
    statusCode = 400,
    meta: Record<string, any> = {}
  ) => {
    res.status(statusCode).json({
      success: false,
      data: null,
      error: { code, message },
      meta: {
        traceId,
        timestamp: new Date().toISOString(),
        ...meta
      }
    });
  };

  next();
};
