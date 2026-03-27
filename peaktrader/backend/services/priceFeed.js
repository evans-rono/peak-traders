// backend/services/priceFeed.js
const WebSocket = require('ws');

// Simulated price feed (replace with real market data provider)
const prices = {
  'EUR/USD': 1.08742,
  'GBP/USD': 1.26381,
  'USD/JPY': 151.62,
  'BTC/USD': 67841.20,
  'ETH/USD': 3542.80,
  'XAU/USD': 2318.40,
  'Volatility 75': 12441.20,
  'Boom 500': 8204.11,
  'Crash 500': 6710.05
};

// Price volatility settings
const volatility = {
  'EUR/USD': 0.0002,
  'GBP/USD': 0.0003,
  'USD/JPY': 0.05,
  'BTC/USD': 50,
  'ETH/USD': 3,
  'XAU/USD': 0.5,
  'Volatility 75': 50,
  'Boom 500': 30,
  'Crash 500': 25
};

// Simulate price movements
function updatePrices() {
  Object.keys(prices).forEach(pair => {
    const change = (Math.random() - 0.5) * volatility[pair];
    prices[pair] = Math.max(0.01, prices[pair] + change);
  });
}

// Update prices every second
setInterval(updatePrices, 1000);

function getCurrentPrice(pair) {
  return prices[pair];
}

function getAllPrices() {
  return { ...prices, timestamp: new Date() };
}

// WebSocket server for real-time price feeds
function setupPriceFeedWebSocket(server) {
  const wss = new WebSocket.Server({ server, path: '/ws/prices' });

  wss.on('connection', (ws) => {
    console.log('Client connected to price feed');
    
    // Send initial prices
    ws.send(JSON.stringify({ type: 'prices', data: getAllPrices() }));

    // Send updates every 2 seconds
    const interval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'prices', data: getAllPrices() }));
      }
    }, 2000);

    ws.on('close', () => {
      clearInterval(interval);
      console.log('Client disconnected from price feed');
    });
  });

  return wss;
}

module.exports = { getCurrentPrice, getAllPrices, setupPriceFeedWebSocket };