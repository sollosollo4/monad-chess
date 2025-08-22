import 'express';

declare module 'express-serve-static-core' {
  interface Response {
    success: (data: any) => void;
    fail: (code: string, message: string, status?: number) => void;
  }
}