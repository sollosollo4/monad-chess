import dotenv from 'dotenv';

dotenv.config();

const requiredVars = [
  'DB_HOST',
  'DB_USER'
];

let error = false;
for (const variable of requiredVars) {
  if (!process.env[variable]) {
    console.error(`[ENV ERROR] Missing required environment variable: ${variable}`);
    error = true;
  }
}
if(error) process.exit(1);

export const ENV = {
  stage: process.env.NODE_ENV || 'local',
  api_port: Number(process.env.PORT) || 3000,
  jwt_secret: process.env.JWT_SECRET || 'JWT_SECRET',
  jwt_refresh_secret: process.env.JWT_REFRESH_SECRET || 'JWT_REFRESH_SECRET',
  database: {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
  },
  websocket: {
    port: parseInt(process.env.WEBSOCKET_PORT || '9870') || 9870,
  },
  rabbitmq_host: process.env.RABBITMQ_URL || 'amqp://rabbitmq',
  llm_api_key: process.env.LLM_API_KEY || '',
};
