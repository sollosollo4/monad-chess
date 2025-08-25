import jwt from 'jsonwebtoken';
import { ENV } from '../config/env';

// Можно вынести секреты в .env
const ACCESS_SECRET = ENV.jwt_secret || 'your-access-secret';
const REFRESH_SECRET = ENV.jwt_refresh_secret || 'your-refresh-secret';

// Генерация access token
export function generateAccessToken(user: { userId: number }): string {
    const payload = { userId: user.userId, type: 'access' };
    return jwt.sign(payload, ACCESS_SECRET, { expiresIn: '30m' });
}

// Генерация refresh token
export function generateRefreshToken(user: { userId: number }): string {
    const payload = { userId: user.userId, type: 'refresh' };
    return jwt.sign(payload, REFRESH_SECRET, { expiresIn: '30d' });
}

// Проверка access token
export function verifyAccessToken(token: string): any {
    return jwt.verify(token, ACCESS_SECRET);
}

// Проверка refresh token
export function verifyRefreshToken(token: string): any {
    return jwt.verify(token, REFRESH_SECRET);
}
