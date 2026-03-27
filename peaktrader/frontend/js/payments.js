// frontend/js/payments.js
// Payment and transaction handling
const PaymentsManager = {
  currentMethod: 'mpesa',
  
  init() {
    this.setupEventListeners();
    this.loadBalance();
    this.loadTransactionHistory();
  },

  setupEventListeners() {
    // Method selection
    document.querySelectorAll('.method-card').forEach(card => {
      card.addEventListener('click', (e) => {
        document.querySelectorAll('.method-card').forEach(c => c.classList.remove('selected'));
        e.currentTarget.classList.add('selected');
        this.currentMethod = e.currentTarget.dataset.method;
        this.updatePaymentForm();
      });
    });

    // Deposit presets
    document.querySelectorAll('.preset-btn[data-type="deposit"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const amount = e.target.dataset.amount;
        document.getElementById('depositAmount').value = amount;
        
        document.querySelectorAll('.preset-btn[data-type="deposit"]').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
      });
    });

    // Withdrawal presets
    document.querySelectorAll('.preset-btn[data-type="withdraw"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const amount = e.target.dataset.amount;
        document.getElementById('withdrawAmount').value = amount;
        
        document.querySelectorAll('.preset-btn[data-type="withdraw"]').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
      });
    });

    // Deposit form
    const depositForm = document.getElementById('depositForm');
    if (depositForm) {
      depositForm.addEventListener('submit', (e) => this.handleDeposit(e));
    }

    // Withdraw form
    const withdrawForm = document.getElementById('withdrawForm');
    if (withdrawForm) {
      withdrawForm.addEventListener('submit', (e) => this.handleWithdraw(e));
    }

    // Tab switching
    document.querySelectorAll('.fin-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const section = e.target.dataset.tab;
        
        document.querySelectorAll('.fin-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.fin-section').forEach(s => s.classList.remove('active'));
        
        e.target.classList.add('active');
        document.getElementById(section).classList.add('active');
      });
    });
  },

  updatePaymentForm() {
    const mpesaForm = document.getElementById('mpesaForm');
    if (mpesaForm) {
      mpesaForm.style.display = this.currentMethod === 'mpesa' ? 'block' : 'none';
    }
  },

  async loadBalance() {
    try {
      const data = await api.getBalance();
      
      const balanceEl = document.getElementById('totalBalance');
      const availableEl = document.getElementById('availableBalance');
      const lockedEl = document.getElementById('lockedBalance');
      
      if (balanceEl) balanceEl.textContent = `KES ${data.balance.toLocaleString()}`;
      if (availableEl) availableEl.textContent = `KES ${data.availableForWithdrawal.toLocaleString()}`;
      if (lockedEl) lockedEl.textContent = `KES ${data.lockedInTrades.toLocaleString()}`;
    } catch (error) {
      console.error('Failed to load balance:', error);
    }
  },

  async handleDeposit(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.textContent;
    
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Processing...';

    try {
      const phone = document.getElementById('mpesaPhone').value;
      const amount = parseInt(document.getElementById('depositAmount').value);

      // Format phone number
      const formattedPhone = phone.startsWith('0') ? '254' + phone.slice(1) : 
                            phone.startsWith('+') ? phone.slice(1) : phone;

      const result = await api.depositMpesa({
        phone: formattedPhone,
        amount
      });

      showToast('Deposit Initiated', 
        'M-Pesa prompt sent to your phone. Enter PIN to confirm.',
        'success',
        6000
      );

      // Start polling for completion
      this.pollTransactionStatus(result.transactionId);

    } catch (error) {
      showToast('Error', error.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  },

  async handleWithdraw(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.textContent;
    
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Processing...';

    try {
      const amount = parseInt(document.getElementById('withdrawAmount').value);
      const method = document.getElementById('withdrawMethod').value;
      
      const data = { amount, method };
      
      if (method === 'mpesa') {
        data.phone = document.getElementById('withdrawPhone').value;
      }

      const result = await api.withdraw(data);

      showToast('Withdrawal Requested', 
        `Reference: ${result.reference}. Expect funds within ${result.estimatedTime}.`,
        'success',
        6000
      );

      this.loadBalance();
      this.loadTransactionHistory();

    } catch (error) {
      showToast('Error', error.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  },

  async loadTransactionHistory() {
    try {
      const data = await api.getTransactionHistory({ limit: 20 });
      this.renderTransactions(data.transactions);
    } catch (error) {
      console.error('Failed to load transactions:', error);
    }
  },

  renderTransactions(transactions) {
    const tbody = document.getElementById('transactionsBody');
    if (!tbody) return;

    tbody.innerHTML = transactions.map(tx => `
      <tr>
        <td class="td-time">${new Date(tx.createdAt).toLocaleDateString('en-KE', { 
          month: 'short', day: 'numeric', year: 'numeric' 
        })}</td>
        <td>
          <span class="badge badge-${tx.type === 'deposit' || tx.type === 'trade_profit' ? 'up' : 'down'}">
            ${tx.type.toUpperCase()}
          </span>
        </td>
        <td>${tx.method.toUpperCase()}</td>
        <td class="td-pair" style="color: ${tx.amount >= 0 ? 'var(--accent)' : 'var(--text)'}">
          ${tx.amount >= 0 ? '+' : ''}KES ${Math.abs(tx.amount).toLocaleString()}
        </td>
        <td style="color: ${tx.status === 'completed' ? 'var(--accent)' : tx.status === 'failed' ? 'var(--red)' : 'var(--amber)'}; font-weight: 600; text-transform: capitalize;">
          ${tx.status}
        </td>
        <td class="td-time" style="font-family: var(--font-mono); font-size: 11px;">
          ${tx.internalRef}
        </td>
      </tr>
    `).join('');
  },

  async pollTransactionStatus(transactionId) {
    // Poll for transaction status updates
    let attempts = 0;
    const maxAttempts = 30; // 5 minutes (10 second intervals)
    
    const checkStatus = async () => {
      attempts++;
      if (attempts > maxAttempts) return;
      
      try {
        // In production, you'd have a specific endpoint to check status
        await this.loadBalance();
        await this.loadTransactionHistory();
        
        // Check if transaction completed
        // If yes, show success toast
      } catch (error) {
        console.error('Status check failed:', error);
      }
      
      setTimeout(checkStatus, 10000);
    };
    
    checkStatus();
  }
};