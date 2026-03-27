// backend/routes/trades.js
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Trade = require('../models/Trade');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { authMiddleware } = require('../middleware/auth');
const { getCurrentPrice } = require('../services/priceFeed');

// Get available assets with current prices
router.get('/assets', async (req, res) => {
  try {
    const assets = [
      { pair: 'EUR/USD', price: 1.08742, change: 0.023, volatility: 'low' },
      { pair: 'GBP/USD', price: 1.26381, change: -0.041, volatility: 'low' },
      { pair: 'USD/JPY', price: 151.62, change: 0.08, volatility: 'medium' },
      { pair: 'BTC/USD', price: 67841.20, change: 1.24, volatility: 'high' },
      { pair: 'ETH/USD', price: 3542.80, change: 0.87, volatility: 'high' },
      { pair: 'XAU/USD', price: 2318.40, change: -0.12, volatility: 'medium' },
      { pair: 'Volatility 75', price: 12441.20, change: 2.31, volatility: 'extreme' },
      { pair: 'Boom 500', price: 8204.11, change: -0.94, volatility: 'extreme' },
      { pair: 'Crash 500', price: 6710.05, change: 1.05, volatility: 'extreme' }
    ];

    // Add real-time price updates
    const assetsWithLivePrices = assets.map(asset => ({
      ...asset,
      price: getCurrentPrice(asset.pair) || asset.price,
      timestamp: new Date()
    }));

    res.json(assetsWithLivePrices);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch assets' });
  }
});

// Place a new trade
router.post('/place', authMiddleware, [
  body('asset').isIn(['EUR/USD', 'GBP/USD', 'USD/JPY', 'BTC/USD', 'ETH/USD', 'XAU/USD', 'Volatility 75', 'Boom 500', 'Crash 500']),
  body('direction').isIn(['UP', 'DOWN']),
  body('amount').isFloat({ min: 100, max: 100000 }),
  body('expiry').isIn(['30s', '1m', '5m', '15m', '1h']),
  body('isDemo').optional().isBoolean()
], async (req, res) => {
  const session = await Trade.startSession();
  session.startTransaction();

  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { asset, direction, amount, expiry, isDemo = false } = req.body;
    const user = await User.findById(req.user._id).session(session);

    // Check balance
    const balanceField = isDemo ? 'demoBalance' : 'balance';
    if (user[balanceField] < amount) {
      await session.abortTransaction();
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    // Deduct amount from balance
    user[balanceField] -= amount;
    await user.save({ session });

    // Calculate expiry time
    const expiryMs = { '30s': 30000, '1m': 60000, '5m': 300000, '15m': 900000, '1h': 3600000 };
    const expiryTime = new Date(Date.now() + expiryMs[expiry]);

    // Get current price
    const entryPrice = getCurrentPrice(asset) || 1.0;

    // Create trade
    const trade = new Trade({
      user: user._id,
      asset,
      direction,
      amount,
      entryPrice,
      expiryTime,
      expiryDuration: expiry,
      isDemo,
      status: 'active'
    });

    await trade.save({ session });
    await session.commitTransaction();

    // Schedule trade settlement
    setTimeout(() => settleTrade(trade._id), expiryMs[expiry]);

    res.status(201).json({
      message: 'Trade placed successfully',
      trade: {
        id: trade._id,
        asset: trade.asset,
        direction: trade.direction,
        amount: trade.amount,
        entryPrice: trade.entryPrice,
        expiryTime: trade.expiryTime,
        payout: amount * 0.92
      },
      balance: user[balanceField]
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Trade placement error:', error);
    res.status(500).json({ error: 'Failed to place trade' });
  } finally {
    session.endSession();
  }
});

// Settle a trade (internal function)
async function settleTrade(tradeId) {
  try {
    const trade = await Trade.findById(tradeId).populate('user');
    if (!trade || trade.status !== 'active') return;

    const exitPrice = getCurrentPrice(trade.asset) || trade.entryPrice;
    const profitLoss = trade.calculateResult(exitPrice);
    
    await trade.save();

    // Update user balance and stats
    const user = trade.user;
    const balanceField = trade.isDemo ? 'demoBalance' : 'balance';
    
    if (trade.status === 'won') {
      user[balanceField] += trade.amount + profitLoss;
      user.tradingStats.winningTrades += 1;
      user.tradingStats.totalProfit += profitLoss;
    } else if (trade.status === 'expired') {
      user[balanceField] += trade.amount; // Return stake on tie
    } else {
      user.tradingStats.totalLoss += Math.abs(profitLoss);
    }
    
    user.tradingStats.totalTrades += 1;
    await user.save();

    // Create transaction record for significant wins
    if (trade.status === 'won' && !trade.isDemo) {
      await Transaction.create({
        user: user._id,
        type: 'trade_profit',
        amount: profitLoss,
        status: 'completed',
        method: 'internal',
        metadata: { tradeId: trade._id }
      });
    }

    console.log(`Trade ${tradeId} settled: ${trade.status}, P&L: ${profitLoss}`);
  } catch (error) {
    console.error('Trade settlement error:', error);
  }
}

// Get user's trades
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const { status, limit = 50, page = 1 } = req.query;
    const query = { user: req.user._id };
    
    if (status) query.status = status;

    const trades = await Trade.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Trade.countDocuments(query);

    res.json({
      trades,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch trade history' });
  }
});

// Get open positions
router.get('/open', authMiddleware, async (req, res) => {
  try {
    const trades = await Trade.find({ 
      user: req.user._id, 
      status: 'active',
      expiryTime: { $gt: new Date() }
    }).sort({ createdAt: -1 });

    res.json(trades);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch open positions' });
  }
});

// Get trading statistics
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const stats = await Trade.aggregate([
      { $match: { user: req.user._id, status: { $in: ['won', 'lost'] } } },
      {
        $group: {
          _id: null,
          totalTrades: { $sum: 1 },
          winningTrades: { $sum: { $cond: [{ $eq: ['$status', 'won'] }, 1, 0] } },
          totalProfit: { $sum: { $cond: [{ $eq: ['$status', 'won'] }, '$profitLoss', 0] } },
          totalLoss: { $sum: { $cond: [{ $eq: ['$status', 'lost'] }, { $abs: '$profitLoss' }, 0] } },
          avgTradeAmount: { $avg: '$amount' }
        }
      }
    ]);

    const todayStats = await Trade.aggregate([
      { 
        $match: { 
          user: req.user._id, 
          createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          status: { $in: ['won', 'lost'] }
        } 
      },
      {
        $group: {
          _id: null,
          todayPnL: { $sum: '$profitLoss' },
          todayTrades: { $sum: 1 }
        }
      }
    ]);

    res.json({
      overall: stats[0] || {
        totalTrades: 0,
        winningTrades: 0,
        totalProfit: 0,
        totalLoss: 0,
        avgTradeAmount: 0
      },
      today: todayStats[0] || { todayPnL: 0, todayTrades: 0 }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

module.exports = router;