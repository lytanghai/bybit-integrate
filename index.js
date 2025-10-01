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


// WebSocket client to Bybit v5 public linear
const ws = new WebSocket("wss://stream.bybit.com/v5/public/linear");


ws.on("open", () => {
console.log("✅ Connected to Bybit WS (v5 public linear)");
ws.send(JSON.stringify({
op: "subscribe",
args: ["publicTrade.XAUUSD"]
}));
});


ws.on("message", (msg) => {
try {
const txt = msg.toString();
console.log("📩", txt);
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