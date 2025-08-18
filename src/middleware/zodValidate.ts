import { ZodSchema } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { ErrorCode } from '../constants/errorCodes';
import { errorMessages } from '../constants/errorMessages';

export function zodValidate(schema: ZodSchema<any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err: any) {

        res.fail(
            ErrorCode.VALIDATION_ERROR,
            err.errors,
            400
        );

    }
  };
}