import { ENV } from "../config/env";
import { Request } from 'express';
export class Helper {
  public static getDepthByRating(rating: number): number {
    if (rating < 100) return 1;
    if (rating < 500) return 2;
    if (rating < 800) return 3;
    if (rating < 900) return 4;
    if (rating < 1200) return 6;
    if (rating < 1600) return 8;
    if (rating < 2000) return 10;
    return 14;
  }

  public static validateOrigin(request: Request): boolean {
    const origin = request.headers["origin"];
    const referer = request.headers["referer"];
    const userAgent = request.headers["user-agent"];

    const allowedOrigins = [
      "http://localhost:3000",
      "https://localhost:3000",
      ENV.frontend_host,
    ].filter(Boolean);

    // Stricter origin validation
    if (!origin || !allowedOrigins.includes(origin)) {
      // Also check referer as fallback, but be more strict
      if (
        !referer ||
        !allowedOrigins.some((allowed) => referer.startsWith(allowed + "/"))
      ) {
        return false;
      }
    }

    // Additional check: reject requests that look like automated tools
    if (
      !userAgent ||
      userAgent.includes("curl") ||
      userAgent.includes("wget") ||
      userAgent.includes("Postman")
    ) {
      return false;
    }

    return true;
  }
}
