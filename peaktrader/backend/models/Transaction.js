// backend/models/Transaction.js
const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, enum: ['deposit', 'withdrawal', 'trade_profit', 'trade_loss', 'bonus', 'refund'], required: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'KES' },
  status: { 
    type: String, 
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
    default: 'pending',
    index: true
  },
  method: { 
    type: String, 
    enum: ['mpesa', 'card', 'bank_transfer', 'crypto', 'internal'],
    required: true 
  },
  reference: { type: String, unique: true, sparse: true }, // External payment reference
  internalRef: { type: String, unique: true }, // Our internal reference
  metadata: {
    phoneNumber: String,
    cardLast4: String,
    bankName: String,
    cryptoAddress: String,
    mpesaReceipt: String,
    failureReason: String
  },
  processedAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

// Generate unique reference before saving
transactionSchema.pre('save', function(next) {
  if (!this.internalRef) {
    const prefix = this.type === 'deposit' ? 'DEP' : 'WTH';
    this.internalRef = `${prefix}${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
  }
  next();
});

module.exports = mongoose.model('Transaction', transactionSchema);