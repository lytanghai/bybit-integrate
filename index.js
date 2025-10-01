import express from "express";
import WebSocket from "ws";

const app = express();
const PORT = process.env.PORT || 3000;

// HTTP endpoint for Render health check
app.get("/", (req, res) => {
  res.send("✅ Bybit WS Test running on Render");
});

app.listen(PORT, () => {
  console.log(`HTTP server listening on port ${PORT}`);

  // WebSocket client to Bybit v5 public inverse (XAUUSD)
  const ws = new WebSocket("wss://stream.bybit.com/v5/public/inverse");

  ws.on("open", () => {
    console.log("✅ Connected to Bybit WS (v5 public inverse)");
    ws.send(JSON.stringify({
      op: "subscribe",
      args: ["trades.BTCUSDT"]  // correct topic
    }));
  });

  ws.on("message", (msg) => {
    try {
      console.log("📩", msg.toString());
    } catch (e) {
      console.log("📩 (non-text message)");
    }
  });

  ws.on("close", () => {
    console.log("❌ Bybit WS connection closed");
  });

  ws.on("error", (err) => {
    console.error("⚠️ Bybit WS error:", err);
  });
});
