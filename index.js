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
    reconnections: reconnectionCount,
    endpointAttempts: endpointAttempts
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: ws && ws.readyState === WebSocket.OPEN ? "connected" : "disconnected",
    currentEndpoint: currentEndpoint,
    lastPrice: lastGoldPrice,
    timestamp: new Date().toISOString()
  });
});

app.get("/endpoints", (req, res) => {
  res.json({
    availableEndpoints: ENDPOINTS,
    currentEndpoint: currentEndpoint,
    endpointStats: endpointAttempts
  });
});

// Multiple Bybit WebSocket endpoints for failover
const ENDPOINTS = [
  "wss://stream.bybit.com/v5/public/linear",
  "wss://stream.bybit.com/v5/public/spot", 
  "wss://stream.bybit.com/v5/public/inverse",
  "wss://stream.bytick.com/v5/public/linear",
  "wss://stream.bytick.com/v5/public/spot"
];

let ws = null;
let reconnectTimeout = null;
let reconnectionCount = 0;
let currentEndpointIndex = 0;
let endpointAttempts = {};
let lastGoldPrice = null;
let currentEndpoint = ENDPOINTS[0];

// Initialize endpoint attempts counter
ENDPOINTS.forEach(endpoint => {
  endpointAttempts[endpoint] = 0;
});

function getNextEndpoint() {
  // Get the next endpoint in round-robin fashion
  currentEndpointIndex = (currentEndpointIndex + 1) % ENDPOINTS.length;
  const endpoint = ENDPOINTS[currentEndpointIndex];
  currentEndpoint = endpoint;
  return endpoint;
}

function getBestEndpoint() {
  // Find endpoint with least attempts (simple load balancing)
  let minAttempts = Infinity;
  let bestEndpoint = ENDPOINTS[0];
  
  for (const endpoint of ENDPOINTS) {
    if (endpointAttempts[endpoint] < minAttempts) {
      minAttempts = endpointAttempts[endpoint];
      bestEndpoint = endpoint;
    }
  }
  
  currentEndpoint = bestEndpoint;
  return bestEndpoint;
}

function markEndpointAttempt(endpoint) {
  endpointAttempts[endpoint] = (endpointAttempts[endpoint] || 0) + 1;
  console.log(`🔧 Endpoint '${endpoint}' attempt count: ${endpointAttempts[endpoint]}`);
}

function markEndpointSuccess(endpoint) {
  // Reset attempt count on successful connection
  endpointAttempts[endpoint] = 0;
  console.log(`✅ Endpoint '${endpoint}' connection successful`);
}

function markEndpointFailure(endpoint) {
  endpointAttempts[endpoint] = (endpointAttempts[endpoint] || 0) + 1;
  console.log(`❌ Endpoint '${endpoint}' failed, attempt count: ${endpointAttempts[endpoint]}`);
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
  
  // Choose endpoint strategy: round-robin or least-attempts
  const endpoint = reconnectionCount % 3 === 0 ? getBestEndpoint() : getNextEndpoint();
  // Every 3rd reconnection, try the least used endpoint
  
  markEndpointAttempt(endpoint);
  
  console.log(`🔗 [Attempt ${reconnectionCount}] Connecting to: ${endpoint}`);
  
  try {
    ws = new WebSocket(endpoint, {
      handshakeTimeout: 10000,
      perMessageDeflate: false,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; GoldPriceMonitor/1.0)'
      }
    });

    let pingInterval;
    let connectionTimeout;

    // Set connection timeout
    connectionTimeout = setTimeout(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        console.log("⏰ Connection timeout - closing...");
        ws.close();
      }
    }, 15000);

    ws.on("open", () => {
      clearTimeout(connectionTimeout);
      console.log("✅ Connected to Bybit WebSocket");
      markEndpointSuccess(endpoint);
      
      // Send subscription message
      const subscribeMessage = {
        op: "subscribe",
        args: ["tickers.XAUUSDT"]
      };
      
      ws.send(JSON.stringify(subscribeMessage));
      console.log("📨 Subscribed to XAUUSDT ticker");

      // Setup periodic ping to keep connection alive
      pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          const pingMsg = { op: "ping", ts: Date.now() };
          ws.send(JSON.stringify(pingMsg));
          console.log("🏓 Sent keep-alive ping");
        }
      }, 25000); // Every 25 seconds
    });

    ws.on("message", (data) => {
      try {
        const parsed = JSON.parse(data.toString());
        
        // Handle subscription response
        if (parsed.success !== undefined) {
          console.log(`📨 Subscription response: ${parsed.ret_msg}`);
          if (parsed.success) {
            console.log("✅ Successfully subscribed to ticker data");
          }
          return;
        }

        // Handle ticker data
        if (parsed.topic === "tickers.XAUUSDT") {
          const ticker = parsed.data;
          lastGoldPrice = ticker.lastPrice;
          console.log(`🟡 GOLD | Price: $${ticker.lastPrice} | Change: ${(ticker.price24hPcnt * 100).toFixed(2)}% | Time: ${new Date().toLocaleTimeString()}`);
          return;
        }
        
        // Handle pings from Bybit
        if (parsed.op === "ping") {
          ws.send(JSON.stringify({ op: "pong", ts: parsed.ts }));
          console.log("🏓 Responded to Bybit ping");
          return;
        }

        // Log other messages briefly for debugging
        if (parsed.ret_msg !== "pong") {
          console.log("📨 Other message type:", parsed.op || parsed.topic || "unknown");
        }

      } catch (error) {
        console.log("📩 Raw message (parse error):", data.toString().substring(0, 100));
      }
    });

    ws.on("close", (code, reason) => {
      console.log(`❌ Connection closed - Code: ${code}, Reason: ${reason || 'No reason provided'}`);
      clearTimeout(connectionTimeout);
      if (pingInterval) clearInterval(pingInterval);
      markEndpointFailure(endpoint);
      scheduleReconnect();
    });

    ws.on("error", (err) => {
      console.error(`⚠️ WebSocket error for ${endpoint}:`, err.message);
      clearTimeout(connectionTimeout);
      if (pingInterval) clearInterval(pingInterval);
      markEndpointFailure(endpoint);
    });

    ws.on("unexpected-response", (req, res) => {
      console.error(`⚠️ Unexpected response from ${endpoint}:`, res.statusCode);
      markEndpointFailure(endpoint);
    });

  } catch (error) {
    console.error("❌ Failed to create WebSocket:", error.message);
    markEndpointFailure(endpoint);
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (reconnectTimeout) return;
  
  // Exponential backoff with max 30 seconds
  const baseDelay = 5000;
  const maxDelay = 30000;
  const delay = Math.min(baseDelay * Math.pow(1.5, reconnectionCount - 1), maxDelay);
  
  console.log(`🔄 Attempting to reconnect in ${Math.round(delay/1000)} seconds...`);
  console.log(`📊 Stats: ${reconnectionCount} total reconnections`);
  
  reconnectTimeout = setTimeout(() => {
    connectWebSocket();
  }, delay);
}

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
  console.log("🛑 SIGTERM received - Shutting down gracefully...");
  if (ws) {
    ws.close();
  }
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
  }
  process.exit(0);
});

process.on("uncaughtException", (error) => {
  console.error("🚨 Uncaught Exception:", error);
  // Don't exit, let the reconnection logic handle it
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("🚨 Unhandled Rejection at:", promise, "reason:", reason);
});