import express from "express";
import { checkJwt, AuthRequest } from "../middleware/auth";
import { verifyMessage, ethers } from "ethers";

const router = express.Router();

router.post("/sign-message", checkJwt, async (req: AuthRequest, res) => {
  const { address, message, signature } = req.body;
  try {
    const recovered = verifyMessage(message, signature);
    if (recovered.toLowerCase() !== address.toLowerCase()) {
      return res.status(400).json({ message: "Invalid signature" });
    }
    // Валидация nonce, логирование и т.д.
    res.json({ valid: true });
  } catch (err) {
    res.status(400).json({ message: "Error verifying signature", error: err });
  }
});

router.post("/send-tx", checkJwt, async (req: AuthRequest, res) => {
  const { address, txData, signature } = req.body;
  try {
    // Проверка подписи транзакции
    // Валидация содержимого
    // Логика аудита
    // Отправка tx через Privy SDK или API
    res.json({ success: true, txHash: "0x..." });
  } catch (err) {
    res.status(400).json({ message: "Error sending transaction", error: err });
  }
});

export default router;