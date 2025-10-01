import express from "express";
import WebSocket from "ws";

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Routes
app.get("/", (req, res) => {
  res.json({ 
    status: "live",
    service: "Bybit Gold Price WebSocket",
    uptime: process.uptime()
  });
});

app.get("/health", (req, res) => {
  res.json({ 
    status: "healthy",
    timestamp: new Date().toISOString(),
    websocket: ws ? "connected" : "disconnected"
  });
});

let ws = null;
let reconnectTimeout = null;

function connectWebSocket() {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }

  if (ws) {
    ws.close();
  }

  console.log("🔗 Connecting to Bybit WebSocket...");
  
  try {
    ws = new WebSocket("wss://stream.bybit.com/v5/public/linear");

    ws.on("open", () => {
      console.log("✅ Connected to Bybit WebSocket");
      
      const subscribeMessage = {
        op: "subscribe",
        args: ["tickers.XAUUSDT"]
      };
      
      ws.send(JSON.stringify(subscribeMessage));
      console.log("📨 Subscribed to XAUUSDT ticker");
    });

    ws.on("message", (data) => {
      try {
        const parsed = JSON.parse(data.toString());
        
        if (parsed.topic === "tickers.XAUUSDT") {
          const ticker = parsed.data;
          console.log(`🟡 GOLD | Price: $${ticker.lastPrice} | Change: ${(ticker.price24hPcnt * 100).toFixed(2)}% | Time: ${new Date().toLocaleTimeString()}`);
        }
        
        if (parsed.op === "ping") {
          ws.send(JSON.stringify({ op: "pong", ts: parsed.ts }));
        }

      } catch (error) {
        // Ignore parse errors
      }
    });

    ws.on("close", () => {
      console.log("❌ Bybit WS connection closed");
      scheduleReconnect();
    });

    ws.on("error", (err) => {
      console.error("⚠️ Bybit WS error:", err.message);
    });

  } catch (error) {
    console.error("❌ Failed to create WebSocket:", error.message);
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (reconnectTimeout) return;
  
  console.log("🔄 Attempting to reconnect in 5 seconds...");
  reconnectTimeout = setTimeout(() => {
    connectWebSocket();
  }, 5000);
}

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🟡 Monitoring Gold (XAUUSDT) prices from Bybit`);
  connectWebSocket();
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("🛑 SIGTERM received - Shutting down gracefully...");
  if (ws) {
    ws.close();
  }
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
  }
  server.close(() => {
    console.log("✅ Server closed");
    process.exit(0);
  });
});