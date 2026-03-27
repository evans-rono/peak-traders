// frontend/js/api.js
const API_BASE_URL = 'http://localhost:5000/api';

class ApiClient {
  constructor() {
    this.baseURL = API_BASE_URL;
    this.token = localStorage.getItem('token');
  }

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  }

  getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...this.getHeaders(),
          ...options.headers,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Request failed');
      }

      return data;
    } catch (error) {
      if (error.message === 'Failed to fetch') {
        throw new Error('Network error. Please check your connection.');
      }
      throw error;
    }
  }

  // Auth endpoints
  async register(userData) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async login(credentials) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  }

  async getCurrentUser() {
    return this.request('/auth/me');
  }

  async changePassword(data) {
    return this.request('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // User endpoints
  async getDashboard() {
    return this.request('/user/dashboard');
  }

  async getProfile() {
    return this.request('/user/profile');
  }

  // Trading endpoints
  async getAssets() {
    return this.request('/trades/assets');
  }

  async placeTrade(tradeData) {
    return this.request('/trades/place', {
      method: 'POST',
      body: JSON.stringify(tradeData),
    });
  }

  async getTradeHistory(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/trades/history?${queryString}`);
  }

  async getOpenPositions() {
    return this.request('/trades/open');
  }

  async getTradeStats() {
    return this.request('/trades/stats');
  }

  // Payment endpoints
  async getBalance() {
    return this.request('/payments/balance');
  }

  async depositMpesa(data) {
    return this.request('/payments/deposit/mpesa', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async withdraw(data) {
    return this.request('/payments/withdraw', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getTransactionHistory(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/payments/history?${queryString}`);
  }
}

// Create global instance
const api = new ApiClient();

// Check for existing token on load
if (localStorage.getItem('token')) {
  api.token = localStorage.getItem('token');
}