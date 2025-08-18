import app, { startApp } from './app';

startApp().then(() => {
  app.listen(3000, () => {
    console.log(`🚀 Server is running on port 3000`);
  });
});