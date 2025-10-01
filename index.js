import express from "express";
import WebSocket from "ws";

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.json({ 
    status: "live",
    service: "Bybit Gold Price WebSocket",
    uptime: process.uptime(),
    currentEndpoint: currentEndpoint,
    reconnections: reconnectionCount
  });
});

// Multiple Bybit WebSocket endpoints
const ENDPOINTS = [
  "wss://stream.bybit.com/v5/public/linear",
  "wss://stream.bybit.com/v5/public/spot", 
  "wss://stream.bybit.com/v5/public/inverse"
];

let ws = null;
let reconnectTimeout = null;
let reconnectionCount = 0;
let currentEndpointIndex = 0;
let currentEndpoint = ENDPOINTS[0];
let lastGoldPrice = null;
let isSubscribed = false;

function getNextEndpoint() {
  currentEndpointIndex = (currentEndpointIndex + 1) % ENDPOINTS.length;
  currentEndpoint = ENDPOINTS[currentEndpointIndex];
  return currentEndpoint;
}

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
  isSubscribed = false;
  
  const endpoint = getNextEndpoint();
  console.log(`🔗 [Attempt ${reconnectionCount}] Connecting to: ${endpoint}`);
  
  try {
    ws = new WebSocket(endpoint, {
      handshakeTimeout: 10000,
      perMessageDeflate: false
    });

    let pingInterval;

    ws.on("open", () => {
      console.log("✅ Connected to Bybit WebSocket");
      
      // Send subscription message immediately
      const subscribeMessage = {
        op: "subscribe",
        args: ["tickers.XAUUSDT"]
      };
      
      console.log("📨 Sending subscription for XAUUSDT...");
      ws.send(JSON.stringify(subscribeMessage));

      // Setup periodic ping (less frequent)
      pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          const pingMsg = { op: "ping" };
          ws.send(JSON.stringify(pingMsg));
        }
      }, 60000); // Every 60 seconds instead of 25
    });

    ws.on("message", (data) => {
      try {
        const parsed = JSON.parse(data.toString());
        
        // Handle subscription response
        if (parsed.success !== undefined && parsed.ret_msg === "subscribe") {
          console.log(`✅ Successfully subscribed to: ${parsed.conn_id}`);
          isSubscribed = true;
          return;
        }

        // Handle ticker data - THIS IS WHAT WE WANT!
        if (parsed.topic && parsed.topic.startsWith("tickers")) {
          const ticker = parsed.data;
          if (ticker.symbol === "XAUUSDT") {
            lastGoldPrice = ticker.lastPrice;
            console.log("═══════════════════════════════════════");
            console.log(`🟡 GOLD PRICE UPDATE`);
            console.log(`💰 Last Price: $${ticker.lastPrice}`);
            console.log(`📊 Mark Price: $${ticker.markPrice}`);
            console.log(`📈 24h Change: ${(ticker.price24hPcnt * 100).toFixed(2)}%`);
            console.log(`🕐 Time: ${new Date().toLocaleTimeString()}`);
            console.log("═══════════════════════════════════════");
          }
          return;
        }
        
        // Handle ping responses
        if (parsed.op === "pong") {
          console.log("🏓 Received pong from Bybit");
          return;
        }

        // Handle pings from Bybit
        if (parsed.op === "ping") {
          ws.send(JSON.stringify({ op: "pong", ts: parsed.ts }));
          return;
        }

        // Log unknown messages for debugging
        if (parsed.ret_msg !== "pong") {
          console.log("📨 Other message:", JSON.stringify(parsed));
        }

      } catch (error) {
        console.log("📩 Raw message:", data.toString().substring(0, 200));
      }
    });

    ws.on("close", (code, reason) => {
      console.log(`❌ Connection closed - Code: ${code}, Reason: ${reason || 'No reason'}`);
      if (pingInterval) clearInterval(pingInterval);
      
      // If we were subscribed but got disconnected, reconnect faster
      const delay = isSubscribed ? 2000 : 5000;
      console.log(`🔄 Reconnecting in ${delay/1000} seconds...`);
      reconnectTimeout = setTimeout(connectWebSocket, delay);
    });

    ws.on("error", (err) => {
      console.error("⚠️ WebSocket error:", err.message);
      if (pingInterval) clearInterval(pingInterval);
    });

  } catch (error) {
    console.error("❌ Failed to create WebSocket:", error.message);
    reconnectTimeout = setTimeout(connectWebSocket, 5000);
  }
}

// Health endpoint to check if we're receiving data
app.get("/health", (req, res) => {
  res.json({
    status: ws && ws.readyState === WebSocket.OPEN ? "connected" : "disconnected",
    subscribed: isSubscribed,
    currentEndpoint: currentEndpoint,
    lastPrice: lastGoldPrice,
    lastUpdate: lastGoldPrice ? new Date().toISOString() : null,
    reconnections: reconnectionCount
  });
});

// Manual reconnect endpoint
app.post("/reconnect", (req, res) => {
  console.log("🔄 Manual reconnection triggered");
  connectWebSocket();
  res.json({ message: "Reconnection initiated" });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🟡 Monitoring Gold (XAUUSDT) prices from Bybit`);
  console.log(`🔧 Available endpoints: ${ENDPOINTS.length}`);
  console.log("═══════════════════════════════════════");
  connectWebSocket();
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("🛑 Shutting down gracefully...");
  if (ws) ws.close();
  if (reconnectTimeout) clearTimeout(reconnectTimeout);
  process.exit(0);
});