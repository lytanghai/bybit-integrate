import express from "express";
import WebSocket from "ws";

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.json({ 
    status: "live",
    service: "Bitget Gold Price WebSocket",
    symbol: "XAUUSDT",
    uptime: process.uptime()
  });
});

let ws = null;
let reconnectTimeout = null;
let reconnectionCount = 0;
let lastGoldPrice = null;

function connectWebSocket() {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }

  if (ws) {
    ws.removeAllListeners();
    ws.close();
  }

  reconnectionCount++;
  
  // Bitget WebSocket for Gold
  const endpoint = "wss://ws.bitget.com/mix/v1/stream";
  
  console.log(`🔗 [Attempt ${reconnectionCount}] Connecting to Bitget for Gold...`);
  
  try {
    ws = new WebSocket(endpoint);

    ws.on("open", () => {
      console.log("✅ Connected to Bitget WebSocket");
      
      // Subscribe to Gold trades
      const subscribeMessage = {
        op: "subscribe",
        args: [{
          instType: "UMCBL",
          channel: "trade",
          instId: "XAUUSDT_UMCBL"
        }]
      };
      
      console.log("📨 Subscribing to Gold trades...");
      ws.send(JSON.stringify(subscribeMessage));
    });

    ws.on("message", (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        // Handle trade data
        if (message.action === "snapshot" && message.arg.channel === "trade") {
          const trades = message.data;
          if (trades && trades.length > 0) {
            const latestTrade = trades[0];
            lastGoldPrice = {
              symbol: "XAUUSDT",
              price: parseFloat(latestTrade.price),
              size: parseFloat(latestTrade.size),
              side: latestTrade.side,
              timestamp: new Date(parseFloat(latestTrade.ts)).toISOString()
            };
            
            console.log("🟡 GOLD TRADE (Bitget)");
            console.log(`💰 Price: $${latestTrade.price}`);
            console.log(`📊 Size: ${latestTrade.size}`);
            console.log(`🎯 Side: ${latestTrade.side}`);
            console.log(`🕐 Time: ${new Date().toLocaleTimeString()}`);
            console.log("═══════════════════════════════════════");
          }
        }
        
        // Handle subscription response
        if (message.event === "subscribe") {
          console.log("✅ Successfully subscribed to Gold trades");
        }

      } catch (error) {
        console.log("📩 Raw message:", data.toString().substring(0, 200));
      }
    });

    ws.on("close", (code, reason) => {
      console.log(`❌ Connection closed - Code: ${code}, Reason: ${reason || 'No reason'}`);
      console.log(`🔄 Reconnecting in 3 seconds...`);
      reconnectTimeout = setTimeout(connectWebSocket, 3000);
    });

    ws.on("error", (err) => {
      console.error("⚠️ WebSocket error:", err.message);
    });

  } catch (error) {
    console.error("❌ Failed to create WebSocket:", error.message);
    reconnectTimeout = setTimeout(connectWebSocket, 3000);
  }
}

// Health endpoint
app.get("/health", (req, res) => {
  res.json({
    status: ws && ws.readyState === WebSocket.OPEN ? "connected" : "disconnected",
    symbol: "XAUUSDT",
    lastTrade: lastGoldPrice,
    reconnections: reconnectionCount
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🟡 Monitoring Gold (XAUUSDT) from Bitget`);
  connectWebSocket();
});

process.on("SIGTERM", () => {
  console.log("🛑 Shutting down gracefully...");
  if (ws) ws.close();
  if (reconnectTimeout) clearTimeout(reconnectTimeout);
  process.exit(0);
});