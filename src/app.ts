import "reflect-metadata";
import cors from "cors";
import cookieParser from "cookie-parser";
import express from "express";
import authRouter from "./endpoints/auth";
import roomsRouter from "./endpoints/rooms";
import walletRouter from "./endpoints/wallet";
import puzzleRouter from "./endpoints/puzzles";
import profileRouter from "./endpoints/profile";

import WebSocketService from "./services/websocket";
import { initDb } from "./config/database";
import { attachTraceId } from "./middleware/loggerWithTraceId";
import { responseWrapper } from "./middleware/responseWrapper";
import { requestLogger } from "./middleware/requestLogger";
import { ENV } from "./config/env";
import { connectRabbit } from "./rabbitmq/client";
import { startConsumer } from "./consumer/consumer";

const app = express();

app.use(
  cors({
    origin: ENV.frontend_host, // yours frontend
    credentials: true,
  })
);

app.use(cookieParser());
app.use(express.json());
app.use(attachTraceId);
app.use(responseWrapper);
app.use(requestLogger);

app.use("/api/auth", authRouter);
app.use("/api/wallet", walletRouter);
app.use("/api/rooms", roomsRouter);
app.use("/api/puzzles", puzzleRouter);
app.use("/api/profile", profileRouter);

export const startApp = async () => {
  await initDb();
  await startConsumer();
  WebSocketService.start();
};

export default app;
