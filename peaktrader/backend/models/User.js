// backend/models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  email: { 
    type: String, 
    required: true, 
    unique: true, 
    lowercase: true,
    trim: true 
  },
  phone: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true 
  },
  country: { type: String, required: true, default: 'Kenya' },
  password: { type: String, required: true, minlength: 6 },
  balance: { type: Number, default: 0, min: 0 },
  demoBalance: { type: Number, default: 10000 }, // For practice trading
  isVerified: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  kycStatus: { 
    type: String, 
    enum: ['pending', 'submitted', 'verified', 'rejected'],
    default: 'pending'
  },
  tradingStats: {
    totalTrades: { type: Number, default: 0 },
    winningTrades: { type: Number, default: 0 },
    totalProfit: { type: Number, default: 0 },
    totalLoss: { type: Number, default: 0 }
  },
  lastLogin: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.getFullName = function() {
  return `${this.firstName} ${this.lastName}`;
};

module.exports = mongoose.model('User', userSchema);