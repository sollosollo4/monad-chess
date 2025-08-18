import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { ENV } from "../config/env";

export interface AuthRequest extends Request {
  user?: any | null;
}

export function optionalAuthMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization || req.headers.Authorization as string;

  if (!authHeader) {
    req.user = null;
    return next();
  }

  if (!authHeader.startsWith("Bearer ")) {
    return res.fail(
      'Unauthorized',
      'Invalid authorization header format',
      401
    );
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = jwt.verify(token, ENV.jwt_secret);
    req.user = payload;
  } catch (err) {
    // Если токен невалиден, просто считаем анонимом
    req.user = null;
  }

  next();
}