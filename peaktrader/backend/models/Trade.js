// backend/models/Trade.js
const mongoose = require('mongoose');

const tradeSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  asset: { 
    type: String, 
    required: true,
    enum: ['EUR/USD', 'GBP/USD', 'USD/JPY', 'BTC/USD', 'ETH/USD', 'XAU/USD', 'Volatility 75', 'Boom 500', 'Crash 500']
  },
  direction: { type: String, enum: ['UP', 'DOWN'], required: true },
  amount: { type: Number, required: true, min: 100 },
  entryPrice: { type: Number, required: true },
  exitPrice: { type: Number },
  expiryTime: { type: Date, required: true },
  expiryDuration: { type: String, enum: ['30s', '1m', '5m', '15m', '1h'], required: true },
  payoutRate: { type: Number, default: 0.92 }, // 92% payout
  status: { 
    type: String, 
    enum: ['pending', 'active', 'won', 'lost', 'cancelled', 'expired'],
    default: 'pending',
    index: true
  },
  profitLoss: { type: Number, default: 0 },
  isDemo: { type: Boolean, default: false },
  closedAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

// Index for querying active trades
tradeSchema.index({ status: 1, expiryTime: 1 });

// Method to calculate result
tradeSchema.methods.calculateResult = function(exitPrice) {
  this.exitPrice = exitPrice;
  const won = this.direction === 'UP' ? exitPrice > this.entryPrice : exitPrice < this.entryPrice;
  
  if (won) {
    this.status = 'won';
    this.profitLoss = this.amount * this.payoutRate;
  } else if (exitPrice === this.entryPrice) {
    this.status = 'expired';
    this.profitLoss = 0; // Return stake on tie
  } else {
    this.status = 'lost';
    this.profitLoss = -this.amount;
  }
  
  this.closedAt = new Date();
  return this.profitLoss;
};

module.exports = mongoose.model('Trade', tradeSchema);