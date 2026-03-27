// frontend/js/trading.js
// Trading functionality
const TradingManager = {
  currentAsset: 'EUR/USD',
  currentAmount: 500,
  currentExpiry: '30s',
  isDemo: false,
  
  async init() {
    // Load available assets
    try {
      const assets = await api.getAssets();
      this.populateAssetSelect(assets);
    } catch (error) {
      showToast('Error', 'Failed to load trading assets');
    }

    // Setup event listeners
    this.setupEventListeners();
    
    // Load open positions
    this.loadOpenPositions();
    
    // Start position checker
    setInterval(() => this.checkPositions(), 5000);
  },

  populateAssetSelect(assets) {
    const select = document.getElementById('assetSelect');
    if (!select) return;

    select.innerHTML = assets.map(asset => 
      `<option value="${asset.pair}" data-price="${asset.price}">${asset.pair}</option>`
    ).join('');

    select.addEventListener('change', (e) => {
      this.currentAsset = e.target.value;
      this.updatePriceDisplay();
    });
  },

  setupEventListeners() {
    // Amount input
    const amountInput = document.getElementById('tradeAmount');
    if (amountInput) {
      amountInput.addEventListener('input', (e) => {
        this.currentAmount = parseInt(e.target.value) || 500;
        this.updatePayout();
      });
    }

    // Quick amount buttons
    document.querySelectorAll('.qa-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const amount = parseInt(e.target.dataset.amount);
        document.getElementById('tradeAmount').value = amount;
        this.currentAmount = amount;
        this.updatePayout();
        
        document.querySelectorAll('.qa-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
      });
    });

    // Expiry options
    document.querySelectorAll('.expiry-option').forEach(opt => {
      opt.addEventListener('click', (e) => {
        const expiry = e.currentTarget.dataset.expiry;
        this.currentExpiry = expiry;
        
        document.querySelectorAll('.expiry-option').forEach(o => o.classList.remove('active'));
        e.currentTarget.classList.add('active');
      });
    });

    // Trade buttons
    const upBtn = document.getElementById('btnUp');
    const downBtn = document.getElementById('btnDown');

    if (upBtn) {
      upBtn.addEventListener('click', () => this.placeTrade('UP'));
    }
    if (downBtn) {
      downBtn.addEventListener('click', () => this.placeTrade('DOWN'));
    }

    // Demo toggle
    const demoToggle = document.getElementById('demoToggle');
    if (demoToggle) {
      demoToggle.addEventListener('change', (e) => {
        this.isDemo = e.target.checked;
        this.updateBalanceDisplay();
      });
    }
  },

  updatePayout() {
    const payout = Math.round(this.currentAmount * 0.92);
    const payoutEl = document.getElementById('payoutValue');
    if (payoutEl) {
      payoutEl.textContent = `KES ${payout.toLocaleString()}`;
    }
  },

  updatePriceDisplay() {
    const price = getCurrentPrice(this.currentAsset);
    if (price) {
      const display = document.getElementById('currentPrice');
      if (display) {
        display.textContent = price.toFixed(5);
      }
    }
  },

  updateBalanceDisplay() {
    const balanceEl = document.getElementById('availableBalance');
    if (balanceEl && AuthManager.user) {
      const balance = this.isDemo ? AuthManager.user.demoBalance : AuthManager.user.balance;
      balanceEl.textContent = `KES ${balance.toLocaleString()}`;
    }
  },

  async placeTrade(direction) {
    if (!AuthManager.user) {
      showToast('Error', 'Please login to trade');
      return;
    }

    const btn = direction === 'UP' ? document.getElementById('btnUp') : document.getElementById('btnDown');
    const originalText = btn.innerHTML;
    
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';

    try {
      const result = await api.placeTrade({
        asset: this.currentAsset,
        direction,
        amount: this.currentAmount,
        expiry: this.currentExpiry,
        isDemo: this.isDemo
      });

      showToast('Trade Placed', 
        `${direction} on ${this.currentAsset} — Potential payout: KES ${(this.currentAmount * 0.92).toLocaleString()}`
      );

      // Update balance
      if (!this.isDemo) {
        AuthManager.user.balance = result.balance;
      } else {
        AuthManager.user.demoBalance = result.balance;
      }
      AuthManager.updateUI();
      this.updateBalanceDisplay();

      // Add to open positions
      this.addOpenPosition(result.trade);
      
      // Refresh history
      this.loadRecentTrades();

    } catch (error) {
      showToast('Error', error.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  },

  async loadOpenPositions() {
    try {
      const positions = await api.getOpenPositions();
      positions.forEach(pos => this.addOpenPosition(pos));
    } catch (error) {
      console.error('Failed to load open positions:', error);
    }
  },

  addOpenPosition(trade) {
    const tbody = document.getElementById('openPositionsBody');
    if (!tbody) return;

    const row = document.createElement('tr');
    row.id = `trade-${trade.id}`;
    row.innerHTML = `
      <td class="td-pair">${trade.asset}</td>
      <td><span class="badge badge-${trade.direction === 'UP' ? 'up' : 'down'}">
        ${trade.direction === 'UP' ? '▲' : '▼'} ${trade.direction}
      </span></td>
      <td>KES ${trade.amount.toLocaleString()}</td>
      <td>${trade.expiryDuration}</td>
      <td><span class="badge badge-pending">OPEN</span></td>
      <td class="td-time countdown" data-expiry="${new Date(trade.expiryTime).getTime()}">--:--</td>
    `;
    
    tbody.insertBefore(row, tbody.firstChild);
  },

  async checkPositions() {
    // Update countdowns
    document.querySelectorAll('.countdown').forEach(el => {
      const expiry = parseInt(el.dataset.expiry);
      const remaining = expiry - Date.now();
      
      if (remaining <= 0) {
        el.textContent = 'Closing...';
        el.classList.add('closing');
      } else {
        const seconds = Math.floor(remaining / 1000);
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        el.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
      }
    });

    // Refresh if any closed
    const closing = document.querySelectorAll('.closing');
    if (closing.length > 0) {
      setTimeout(() => {
        this.loadRecentTrades();
        closing.forEach(el => el.closest('tr').remove());
      }, 2000);
    }
  },

  async loadRecentTrades() {
    try {
      const data = await api.getTradeHistory({ limit: 10 });
      this.renderTradeHistory(data.trades);
    } catch (error) {
      console.error('Failed to load trades:', error);
    }
  },

  renderTradeHistory(trades) {
    const tbody = document.getElementById('tradesHistoryBody');
    if (!tbody) return;

    tbody.innerHTML = trades.map(trade => `
      <tr>
        <td class="td-pair">${trade.asset}</td>
        <td>
          <span class="badge badge-${trade.direction === 'UP' ? 'up' : 'down'}">
            ${trade.direction === 'UP' ? '▲' : '▼'} ${trade.direction}
          </span>
        </td>
        <td>KES ${trade.amount.toLocaleString()}</td>
        <td>${trade.expiryDuration}</td>
        <td style="color: ${trade.status === 'won' ? 'var(--accent)' : trade.status === 'lost' ? 'var(--red)' : 'var(--amber)'}; font-weight: 600; text-transform: uppercase;">
          ${trade.status}
        </td>
        <td class="${trade.profitLoss >= 0 ? 'td-profit' : 'td-loss'}">
          ${trade.profitLoss >= 0 ? '+' : ''}KES ${Math.abs(trade.profitLoss).toLocaleString()}
        </td>
        <td class="td-time">${new Date(trade.createdAt).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}</td>
      </tr>
    `).join('');
  }
};