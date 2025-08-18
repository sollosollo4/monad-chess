import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';

let currentTraceId: string | undefined = undefined;

export function setTraceId(traceId: string) {
  currentTraceId = traceId;
}

export function clearTraceId() {
  currentTraceId = undefined;
}

const rawLogger = pino({
  base: {
    service: process.env.SERVICE_NAME || 'web-api',
    env: process.env.NODE_ENV || 'dev'
  },
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level(label) {
      return { level: label };
    }
  },
  transport: isProduction
    ? undefined
    : {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          singleLine: true,
          messageFormat: '{msg} | service={service}',
        },
      },
});

function wrap(method: 'info' | 'error' | 'warn' | 'debug') {
  return (...args: any[]) => {
    if (typeof args[0] === 'string') {
      rawLogger[method]({
        msg: args[0],
        traceId: currentTraceId,
      });
    } else if (typeof args[0] === 'object') {
      rawLogger[method]({
        ...args[0],
        traceId: currentTraceId,
      });
    } else {
      rawLogger[method](...args);
    }
  };
}

export const logger = {
  info: wrap('info'),
  error: wrap('error'),
  warn: wrap('warn'),
  debug: wrap('debug'),
};
