import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { ENV } from "../config/env";

export interface AuthRequest extends Request {
  userId?: number;
}

export function checkJwt(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token provided" });
  try {
    const payload = jwt.verify(token, ENV.jwt_secret);
    req.userId = (payload as any).userId;
    next();
  } catch {
    res.status(401).json({ message: "Invalid token" });
  }
}