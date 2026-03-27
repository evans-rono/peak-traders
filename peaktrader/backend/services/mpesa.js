// backend/services/mpesa.js
const axios = require('axios');

class MpesaService {
  constructor() {
    this.baseURL = process.env.MPESA_ENV === 'production' 
      ? 'https://api.safaricom.co.ke'
      : 'https://sandbox.safaricom.co.ke';
    
    this.consumerKey = process.env.MPESA_CONSUMER_KEY;
    this.consumerSecret = process.env.MPESA_CONSUMER_SECRET;
    this.passkey = process.env.MPESA_PASSKEY;
    this.shortcode = process.env.MPESA_SHORTCODE;
    this.callbackUrl = process.env.MPESA_CALLBACK_URL;
  }

  async getAccessToken() {
    const auth = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString('base64');
    
    const response = await axios.get(`${this.baseURL}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { Authorization: `Basic ${auth}` }
    });
    
    return response.data.access_token;
  }

  async initiateSTKPush(phone, amount, accountReference, transactionDesc = 'PeakTrader Deposit') {
    const token = await this.getAccessToken();
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
    const password = Buffer.from(`${this.shortcode}${this.passkey}${timestamp}`).toString('base64');

    const payload = {
      BusinessShortCode: this.shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.round(amount),
      PartyA: phone,
      PartyB: this.shortcode,
      PhoneNumber: phone,
      CallBackURL: this.callbackUrl,
      AccountReference: accountReference,
      TransactionDesc: transactionDesc
    };

    const response = await axios.post(`${this.baseURL}/mpesa/stkpush/v1/processrequest`, payload, {
      headers: { Authorization: `Bearer ${token}` }
    });

    return response.data;
  }

  async queryTransaction(checkoutRequestId) {
    const token = await this.getAccessToken();
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
    const password = Buffer.from(`${this.shortcode}${this.passkey}${timestamp}`).toString('base64');

    const payload = {
      BusinessShortCode: this.shortcode,
      Password: password,
      Timestamp: timestamp,
      CheckoutRequestID: checkoutRequestId
    };

    const response = await axios.post(`${this.baseURL}/mpesa/stkpushquery/v1/query`, payload, {
      headers: { Authorization: `Bearer ${token}` }
    });

    return response.data;
  }

  // B2C Payment (for withdrawals)
  async sendB2CPayment(phone, amount, remarks = 'PeakTrader Withdrawal') {
    const token = await this.getAccessToken();
    
    const payload = {
      InitiatorName: process.env.MPESA_INITIATOR_NAME,
      SecurityCredential: process.env.MPESA_SECURITY_CREDENTIAL,
      CommandID: 'BusinessPayment',
      Amount: Math.round(amount),
      PartyA: this.shortcode,
      PartyB: phone,
      Remarks: remarks,
      QueueTimeOutURL: `${this.callbackUrl}/b2c-timeout`,
      ResultURL: `${this.callbackUrl}/b2c-result`,
      Occasion: 'Withdrawal'
    };

    const response = await axios.post(`${this.baseURL}/mpesa/b2c/v1/paymentrequest`, payload, {
      headers: { Authorization: `Bearer ${token}` }
    });

    return response.data;
  }
}

module.exports = new MpesaService();