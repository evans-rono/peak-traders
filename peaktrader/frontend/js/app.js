// frontend/js/app.js
// Main application initialization and utilities

// Toast notification system
function showToast(title, message, type = 'success', duration = 4000) {
  const container = document.querySelector('.toast-container') || createToastContainer();
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div class="toast-title">${title}</div>
    <div class="toast-message">${message}</div>
  `;
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('hiding');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

function createToastContainer() {
  const container = document.createElement('div');
  container.className = 'toast-container';
  document.body.appendChild(container);
  return container;
}

// Time update
function updateLiveTime() {
  const timeEl = document.getElementById('liveTime');
  if (timeEl) {
    timeEl.textContent = new Date().toLocaleTimeString('en-KE', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }
}

// Format currency
function formatCurrency(amount, currency = 'KES') {
  return `${currency} ${amount.toLocaleString('en-KE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

// Format percentage
function formatPercentage(value) {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

// Mobile menu toggle
function initMobileMenu() {
  const toggle = document.getElementById('mobileMenuToggle');
  const sidebar = document.querySelector('.sidebar');
  
  if (toggle && sidebar) {
    toggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });
    
    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!sidebar.contains(e.target) && !toggle.contains(e.target)) {
        sidebar.classList.remove('open');
      }
    });
  }
}

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
  // Start live time
  updateLiveTime();
  setInterval(updateLiveTime, 1000);
  
  // Initialize mobile menu
  initMobileMenu();
  
  // Check auth status
  const isAuthenticated = await AuthManager.init();
  
  // Page-specific initialization
  const currentPage = document.body.dataset.page;
  
  switch (currentPage) {
    case 'dashboard':
      if (!isAuthenticated) {
        window.location.href = '/pages/login.html';
        return;
      }
      await TradingManager.init();
      connectPriceFeed((prices) => {
        // Update price displays
        const price = prices[TradingManager.currentAsset];
        if (price) {
          updateChartData(price);
          TradingManager.updatePriceDisplay();
        }
      });
      initChart('tradeChart');
      break;
      
    case 'deposit':
      if (!isAuthenticated) {
        window.location.href = '/pages/login.html';
        return;
      }
      PaymentsManager.init();
      break;
      
    case 'login':
    case 'register':
      if (isAuthenticated) {
        window.location.href = '/pages/dashboard.html';
      }
      break;
  }
});

// Handle window unload
window.addEventListener('beforeunload', () => {
  disconnectPriceFeed();
});