const WebSocket = require('ws');
require('dotenv').config();

// Tiingo WebSocket endpoint
const wsUrl = 'wss://api.tiingo.com/iex';

// Symbol to subscribe
const symbol = 'XAUUSD';

const ws = new WebSocket(wsUrl, {
  headers: { 'Authorization': `Token ${process.env.TIINGO_API_KEY}` }
});

ws.on('open', () => {
  console.log('✅ Connected to Tiingo WebSocket');
  ws.send(JSON.stringify({ type: 'subscribe', symbols: [symbol] }));
});

ws.on('message', (message) => {
  try {
    const data = JSON.parse(message);
    // Tiingo sends array of ticks sometimes
    const ticks = Array.isArray(data) ? data : [data];

    ticks.forEach(tick => {
      if (tick.symbol === symbol) {
        const { last, bidPrice, askPrice, timestamp } = tick;
        console.log(`📊 XAUUSD | Last: ${last} | Bid: ${bidPrice} | Ask: ${askPrice} | Time: ${new Date(timestamp).toISOString()}`);
      }
    });

  } catch (err) {
    console.error('❌ Error parsing message:', err.message);
  }
});

ws.on('close', () => console.log('🔌 WebSocket closed'));
ws.on('error', (err) => console.error('⚠️ WebSocket error:', err.message));

// Optional: Health check endpoint for Render
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('Tiingo XAU/USD WebSocket running ✅'));

app.listen(PORT, () => console.log(`🌍 Server running on port ${PORT}`));
