const WebSocket = require("ws");

// Exness WebSocket endpoint
const ws = new WebSocket("wss://ws.exness.com/v3/public/quotes");

// Keep track of last logged price to avoid duplicates
let lastBid = null;
let lastAsk = null;

ws.on("open", () => {
  console.log("✅ Connected to Exness WebSocket");
  // Subscribe to XAU/USD
  ws.send(JSON.stringify({ type: "subscribe", symbols: ["XAUUSD"] }));
});

ws.on("message", (message) => {
  try {
    const data = JSON.parse(message);

    if (data.type === "quote" && data.symbol === "XAUUSD") {
      const { bid, ask, timestamp } = data;

      // Only log if price changed
      if (bid !== lastBid || ask !== lastAsk) {
        console.log(
          `📊 XAUUSD Tick | Bid: ${bid} | Ask: ${ask} | Timestamp: ${new Date(timestamp).toISOString()}`
        );
        lastBid = bid;
        lastAsk = ask;
      }
    }
  } catch (err) {
    console.error("❌ Error parsing message:", err.message);
  }
});

ws.on("close", () => console.log("🔌 WebSocket closed"));
ws.on("error", (err) => console.error("⚠️ WebSocket error:", err.message));
