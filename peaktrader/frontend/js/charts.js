// frontend/js/charts.js
// Chart management and price feed

let chart = null;
const chartData = { labels: [], prices: [] };
const localPrices = {};
const MAX_POINTS = 60;

// WebSocket price feed
let ws = null;

function connectPriceFeed(onPriceUpdate) {
  ws = new WebSocket('ws://localhost:5000/ws/prices');

  ws.onopen = () => {
    console.log('Price feed connected');
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'prices') {
        Object.assign(localPrices, msg.data);
        if (onPriceUpdate) onPriceUpdate(msg.data);
      }
    } catch (e) {
      console.error('Price feed parse error:', e);
    }
  };

  ws.onerror = () => {
    console.warn('WebSocket error — falling back to polling');
    pollPrices(onPriceUpdate);
  };

  ws.onclose = () => {
    console.log('Price feed disconnected');
    // Reconnect after 3 seconds
    setTimeout(() => connectPriceFeed(onPriceUpdate), 3000);
  };
}

function disconnectPriceFeed() {
  if (ws) {
    ws.close();
    ws = null;
  }
}

// Fallback: poll REST endpoint if WebSocket fails
async function pollPrices(onPriceUpdate) {
  try {
    const assets = await api.getAssets();
    assets.forEach(a => { localPrices[a.pair] = a.price; });
    if (onPriceUpdate) onPriceUpdate(localPrices);
  } catch (e) {
    console.error('Price poll failed:', e);
  }
  setTimeout(() => pollPrices(onPriceUpdate), 2000);
}

function getCurrentPrice(pair) {
  return localPrices[pair] || null;
}

function updateChartData(price) {
  if (!price) return;

  const now = new Date().toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  chartData.labels.push(now);
  chartData.prices.push(price);

  if (chartData.labels.length > MAX_POINTS) {
    chartData.labels.shift();
    chartData.prices.shift();
  }

  if (chart) {
    chart.data.labels = [...chartData.labels];
    chart.data.datasets[0].data = [...chartData.prices];
    chart.update('none'); // 'none' = no animation for live data
  }
}

function initChart(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const ctx = canvas.getContext('2d');

  chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: chartData.labels,
      datasets: [{
        label: 'Price',
        data: chartData.prices,
        borderColor: '#00ff88',
        borderWidth: 2,
        pointRadius: 0,
        fill: true,
        backgroundColor: (context) => {
          const gradient = context.chart.ctx.createLinearGradient(0, 0, 0, 300);
          gradient.addColorStop(0, 'rgba(0,255,136,0.15)');
          gradient.addColorStop(1, 'rgba(0,255,136,0)');
          return gradient;
        },
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { intersect: false, mode: 'index' },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1a1a2e',
          borderColor: '#00ff88',
          borderWidth: 1,
          titleColor: '#a0a0b0',
          bodyColor: '#ffffff',
          callbacks: {
            label: (ctx) => ` ${ctx.parsed.y.toFixed(5)}`
          }
        }
      },
      scales: {
        x: {
          ticks: { color: '#606080', font: { size: 10 }, maxTicksLimit: 8 },
          grid: { color: 'rgba(255,255,255,0.03)' }
        },
        y: {
          position: 'right',
          ticks: { color: '#606080', font: { size: 10 } },
          grid: { color: 'rgba(255,255,255,0.05)' }
        }
      }
    }
  });
}