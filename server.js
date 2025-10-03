import express from "express";
import { WebSocket } from "ws";

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static HTML
app.use(express.static("public"));

// Create a WebSocket connection to Bybit (from Render server)
const bybitWS = new WebSocket("wss://stream.bybit.com/v5/public/linear");

let lastPrice = null;

bybitWS.on("open", () => {
  console.log("Connected to Bybit ✅");
  bybitWS.send(JSON.stringify({
    op: "subscribe",
    args: ["tickers.XAUUSD"]
  }));
});

bybitWS.on("message", (msg) => {
  const data = JSON.parse(msg.toString());
  if (data.topic === "tickers" && data.data?.lastPrice) {
    lastPrice = data.data.lastPrice;
  }
});

// SSE endpoint for browser
app.get("/price", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const interval = setInterval(() => {
    if (lastPrice) {
      res.write(`data: ${lastPrice}\n\n`);
    }
  }, 1000);

  req.on("close", () => {
    clearInterval(interval);
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
