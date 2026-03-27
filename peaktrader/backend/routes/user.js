// backend/routes/user.js
const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const User = require('../models/User');
const Trade = require('../models/Trade');

// Get user profile
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Update profile
router.patch('/profile', authMiddleware, async (req, res) => {
  try {
    const allowedUpdates = ['firstName', 'lastName', 'phone'];
    const updates = {};
    
    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updates,
      { new: true, runValidators: true }
    ).select('-password');

    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Get dashboard data
router.get('/dashboard', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    // Get recent trades
    const recentTrades = await Trade.find({ user: user._id })
      .sort({ createdAt: -1 })
      .limit(10);

    // Get open positions
    const openPositions = await Trade.find({ 
      user: user._id, 
      status: 'active',
      expiryTime: { $gt: new Date() }
    });

    // Calculate today's P&L
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayTrades = await Trade.find({
      user: user._id,
      closedAt: { $gte: todayStart },
      status: { $in: ['won', 'lost'] }
    });

    const todayPnL = todayTrades.reduce((sum, trade) => sum + trade.profitLoss, 0);

    res.json({
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        balance: user.balance,
        demoBalance: user.demoBalance,
        tradingStats: user.tradingStats
      },
      recentTrades,
      openPositions,
      todayPnL,
      openPositionsCount: openPositions.length
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

module.exports = router;