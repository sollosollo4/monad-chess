import app, { startApp } from './app';
import { logger } from './utils/log';

startApp().then(() => {
  app.listen(3000, () => {
    logger.info(`🚀 Server is running on port 3000`);
  });
});