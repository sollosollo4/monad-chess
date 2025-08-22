import jwt from 'jsonwebtoken';

// Можно вынести секреты в .env
const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'your-access-secret';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret';

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
