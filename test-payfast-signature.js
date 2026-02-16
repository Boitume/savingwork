import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env
dotenv.config({ path: path.join(__dirname, '.env') });

function generatePayFastSignature(data) {
  // Clean data
  const cleanData = {};
  Object.keys(data).forEach(key => {
    if (data[key] !== undefined && data[key] !== null && data[key] !== '') {
      cleanData[key] = data[key];
    }
  });

  // Sort keys alphabetically
  const keys = Object.keys(cleanData).sort();
  
  // Build parameter string
  const paramString = keys.map(key => {
    let value = String(cleanData[key]).trim();
    const encodedValue = encodeURIComponent(value).replace(/%20/g, '+');
    return `${key}=${encodedValue}`;
  }).join('&');

  // Add passphrase
  const passphrase = String(process.env.PAYFAST_PASSPHRASE).trim();
  const stringToHash = `${paramString}&passphrase=${passphrase}`;

  // Generate MD5 hash
  return crypto.createHash('md5').update(stringToHash).digest('hex');
}

// Test with actual data
const testData = {
  merchant_id: process.env.PAYFAST_MERCHANT_ID,
  merchant_key: process.env.PAYFAST_MERCHANT_KEY,
  return_url: `${process.env.APP_BASE_URL}/payment/success`,
  cancel_url: `${process.env.APP_BASE_URL}/payment/cancel`,
  notify_url: `${process.env.APP_BASE_URL}/payfast/notify`,
  m_payment_id: `test_${Date.now()}`,
  amount: "100.00",
  item_name: "Savings Deposit",
  custom_str1: "test_user_123"
};

console.log('\n' + '='.repeat(60));
console.log('🔐 SIGNATURE TEST');
console.log('='.repeat(60));

const signature = generatePayFastSignature(testData);

console.log('\n✅ Signature:', signature);

// Build the complete URL for testing
const queryString = Object.keys(testData)
  .sort()
  .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(testData[key])}`)
  .join('&');

const testUrl = `${process.env.PAYFAST_BASE_URL}?${queryString}&signature=${signature}`;
console.log('\n🔗 Test URL:');
console.log(testUrl);
console.log('='.repeat(60) + '\n');