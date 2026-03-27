// backend/routes/payments.js
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const crypto = require('crypto');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth');

// M-Pesa configuration (sandbox/production)
const MPESA_CONFIG = {
  consumerKey: process.env.MPESA_CONSUMER_KEY || 'your-consumer-key',
  consumerSecret: process.env.MPESA_CONSUMER_SECRET || 'your-consumer-secret',
  passkey: process.env.MPESA_PASSKEY || 'your-passkey',
  shortcode: process.env.MPESA_SHORTCODE || '174379',
  callbackUrl: process.env.MPESA_CALLBACK_URL || 'https://yourdomain.com/api/payments/mpesa-callback'
};

// Initiate M-Pesa STK Push deposit
router.post('/deposit/mpesa', authMiddleware, [
  body('phone').matches(/^254[0-9]{9}$/).withMessage('Valid Kenyan phone number required (254XXXXXXXXX)'),
  body('amount').isFloat({ min: 500, max: 150000 }).withMessage('Amount must be between 500 and 150,000 KES')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { phone, amount } = req.body;

    // Create pending transaction
    const transaction = await Transaction.create({
      user: req.user._id,
      type: 'deposit',
      amount,
      method: 'mpesa',
      status: 'pending',
      metadata: { phoneNumber: phone }
    });

    // TODO: Integrate with actual M-Pesa API
    // For now, simulate STK push
    const stkPushResponse = await initiateSTKPush(phone, amount, transaction.internalRef);

    res.json({
      message: 'M-Pesa STK push initiated. Check your phone to complete payment.',
      transactionId: transaction._id,
      reference: transaction.internalRef,
      checkoutRequestId: stkPushResponse.checkoutRequestId
    });
  } catch (error) {
    console.error('M-Pesa deposit error:', error);
    res.status(500).json({ error: 'Failed to initiate deposit' });
  }
});

// Simulate M-Pesa STK Push (replace with actual Daraja API integration)
async function initiateSTKPush(phone, amount, accountReference) {
  // In production, make actual API call to Safaricom Daraja API
  // For demo, return simulated response
  return {
    checkoutRequestId: 'ws_' + Date.now(),
    responseCode: '0',
    responseDescription: 'Success. Request accepted for processing',
    customerMessage: 'Success. Request accepted for processing'
  };
}

// M-Pesa callback handler
router.post('/mpesa-callback', async (req, res) => {
  try {
    const { Body } = req.body;
    
    if (Body.stkCallback.ResultCode === 0) {
      // Payment successful
      const checkoutRequestId = Body.stkCallback.CheckoutRequestID;
      const mpesaReceipt = Body.stkCallback.CallbackMetadata.Item.find(i => i.Name === 'MpesaReceiptNumber')?.Value;
      const amount = Body.stkCallback.CallbackMetadata.Item.find(i => i.Name === 'Amount')?.Value;
      const phone = Body.stkCallback.CallbackMetadata.Item.find(i => i.Name === 'PhoneNumber')?.Value;

      // Find and update transaction
      const transaction = await Transaction.findOne({ 'metadata.checkoutRequestId': checkoutRequestId });
      
      if (transaction && transaction.status === 'pending') {
        transaction.status = 'completed';
        transaction.metadata.mpesaReceipt = mpesaReceipt;
        transaction.processedAt = new Date();
        await transaction.save();

        // Update user balance
        const user = await User.findById(transaction.user);
        user.balance += parseFloat(amount);
        await user.save();

        console.log(`Deposit completed: ${transaction.internalRef}, Amount: ${amount}`);
      }
    } else {
      // Payment failed
      console.log('M-Pesa payment failed:', Body.stkCallback.ResultDesc);
    }

    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (error) {
    console.error('M-Pesa callback error:', error);
    res.status(500).json({ ResultCode: 1, ResultDesc: 'Error processing callback' });
  }
});

// Request withdrawal
router.post('/withdraw', authMiddleware, [
  body('amount').isFloat({ min: 1000 }).withMessage('Minimum withdrawal is 1,000 KES'),
  body('method').isIn(['mpesa', 'bank_transfer', 'crypto']),
  body('phone').if(body('method').equals('mpesa')).matches(/^254[0-9]{9}$/),
  body('bankDetails').if(body('method').equals('bank_transfer')).isObject(),
  body('cryptoAddress').if(body('method').equals('crypto')).isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { amount, method, phone, bankDetails, cryptoAddress } = req.body;
    const user = await User.findById(req.user._id);

    // Check available balance (excluding amount in open trades)
    const openTradesAmount = await Trade.aggregate([
      { $match: { user: user._id, status: 'active' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const lockedAmount = openTradesAmount[0]?.total || 0;
    const availableBalance = user.balance - lockedAmount;

    if (amount > availableBalance) {
      return res.status(400).json({ 
        error: 'Insufficient available balance',
        available: availableBalance,
        locked: lockedAmount
      });
    }

    // Create withdrawal transaction
    const transaction = await Transaction.create({
      user: user._id,
      type: 'withdrawal',
      amount: -amount,
      method,
      status: 'processing',
      metadata: {
        phoneNumber: phone,
        bankName: bankDetails?.bankName,
        accountNumber: bankDetails?.accountNumber,
        cryptoAddress
      }
    });

    // Deduct from balance immediately (or hold in escrow based on your risk policy)
    user.balance -= amount;
    await user.save();

    // TODO: Integrate with actual payout system
    // Process withdrawal via M-Pesa B2C API, bank transfer, or crypto

    res.json({
      message: 'Withdrawal request submitted successfully',
      transactionId: transaction._id,
      reference: transaction.internalRef,
      status: 'processing',
      estimatedTime: method === 'mpesa' ? '24 hours' : '1-3 business days'
    });
  } catch (error) {
    console.error('Withdrawal error:', error);
    res.status(500).json({ error: 'Failed to process withdrawal' });
  }
});

// Get transaction history
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const { type, status, limit = 50, page = 1 } = req.query;
    const query = { user: req.user._id };
    
    if (type) query.type = type;
    if (status) query.status = status;

    const transactions = await Transaction.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Transaction.countDocuments(query);

    res.json({
      transactions,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch transaction history' });
  }
});

// Get balance summary
router.get('/balance', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    // Calculate locked amount in open trades
    const openTrades = await Trade.aggregate([
      { $match: { user: user._id, status: 'active' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const lockedInTrades = openTrades[0]?.total || 0;

    res.json({
      balance: user.balance,
      demoBalance: user.demoBalance,
      lockedInTrades,
      availableForWithdrawal: user.balance - lockedInTrades,
      currency: 'KES'
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch balance' });
  }
});

module.exports = router;