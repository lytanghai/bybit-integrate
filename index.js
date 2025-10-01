import express from "express";
import WebSocket from "ws";

const app = express();
const PORT = process.env.PORT || 3000;

// HTTP endpoint for Render health check
app.get("/", (req, res) => {
    res.send("✅ Bitget WS Test running on Render");
});

app.listen(PORT, () => {
    console.log(`HTTP server listening on port ${PORT}`);

    // Bitget WebSocket public endpoint
    const ws = new WebSocket("wss://ws.bitget.com/mix/v1/stream");

    ws.on("open", () => {
        console.log("✅ Connected to Bitget WS");

        const subscribeMsg = {
            op: "subscribe",
            args: [
                {
                    instType: "UMCBL",
                    channel: "trade",
                    instId: "XAUUSDT_UMCBL"
                }
            ]
        };
        ws.send(JSON.stringify(subscribeMsg));

    });

    ws.on("message", (msg) => {
        try {
            const data = JSON.parse(msg.toString());
            console.log("📩", JSON.stringify(data, null, 2));
        } catch (e) {
            console.log("📩 (non-JSON message)", msg.toString());
        }
    });

    ws.on("close", () => {
        console.log("❌ Bitget WS connection closed");
    });

    ws.on("error", (err) => {
        console.error("⚠️ Bitget WS error:", err);
    });
});
