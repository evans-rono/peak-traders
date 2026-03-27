// frontend/js/charts.js
// Chart.js configuration and price feed handling
let priceChart = null;
let priceSocket = null;
let currentPrices = {};

function initChart(canvasId, initialData = []) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return null;

  const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 400);
  gradient.addColorStop(0, 'rgba(0,229,160,0.1)');
  gradient.addColorStop(1, 'rgba(0,229,160,0)');

  priceChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: initialData.map(d => d.time),
      datasets: [{
        label: 'Price',
        data: initialData.map(d => d.price),
        borderColor: '#00e5a0',
        backgroundColor: gradient,
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 6,
        fill: true,
        tension: 0.4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: 'index',
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1c2230',
          titleColor: '#6b7280',
          bodyColor: '#e8eaf0',
          borderColor: 'rgba(0,229,160,0.3)',
          borderWidth: 1,
          padding: 12,
          displayColors: false,
          callbacks: {
            label: (context) => ` ${context.parsed.y.toFixed(5)}`
          }
        }
      },
      scales: {
        x: {
          grid: {
            color: 'rgba(255,255,255,0.03)',
            drawBorder: false
          },
          ticks: {
            color: '#6b7280',
            font: { family: 'IBM Plex Mono', size: 10 },
            maxTicksLimit: 8
          }
        },
        y: {
          position: 'right',
          grid: {
            color: 'rgba(255,255,255,0.03)',
            drawBorder: false
          },
          ticks: {
            color: '#6b7280',
            font: { family: 'IBM Plex Mono', size: 10 }
          }
        }
      },
      animation: false
    }
  });

  return priceChart;
}

function updateChartData(newPrice) {
  if (!priceChart) return;

  const now = new Date();
  const timeLabel = now.toLocaleTimeString('en-KE', { 
    hour12: false, 
    hour: '2-digit', 
    minute: '2-digit',
    second: '2-digit'
  });

  priceChart.data.labels.push(timeLabel);
  priceChart.data.datasets[0].data.push(newPrice);

  // Keep last 100 data points
  if (priceChart.data.labels.length > 100) {
    priceChart.data.labels.shift();
    priceChart.data.datasets[0].data.shift();
  }

  priceChart.update('none');
}

function connectPriceFeed(onPriceUpdate) {
  const wsUrl = `ws://localhost:5000/ws/prices`;
  
  priceSocket = new WebSocket(wsUrl);

  priceSocket.onopen = () => {
    console.log('Connected to price feed');
  };

  priceSocket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    
    if (message.type === 'prices') {
      currentPrices = message.data;
      if (onPriceUpdate) {
        onPriceUpdate(message.data);
      }
    }
  };

  priceSocket.onerror = (error) => {
    console.error('Price feed error:', error);
  };

  priceSocket.onclose = () => {
    console.log('Price feed disconnected. Reconnecting...');
    setTimeout(() => connectPriceFeed(onPriceUpdate), 3000);
  };

  return priceSocket;
}

function disconnectPriceFeed() {
  if (priceSocket) {
    priceSocket.close();
    priceSocket = null;
  }
}

function getCurrentPrice(pair) {
  return currentPrices[pair] || null;
}