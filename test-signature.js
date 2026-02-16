import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env
dotenv.config({ path: path.join(__dirname, '.env') });

function buildPayFastSignature(params) {
  // Sort keys alphabetically
  const orderedKeys = Object.keys(params).sort();
  
  // Build parameter string
  const paramString = orderedKeys
    .map(key => {
      // Encode value and ensure spaces are +
      const value = String(params[key]).replace(/%20/g, '+');
      return `${key}=${encodeURIComponent(value).replace(/%20/g, '+')}`;
    })
    .join('&');
  
  console.log('Parameter string:', paramString);
  
  // Add passphrase
  const stringToHash = paramString + `&passphrase=${process.env.PAYFAST_PASSPHRASE}`;
  console.log('String to hash:', stringToHash);
  
  // Generate MD5 hash
  return crypto
    .createHash('md5')
    .update(stringToHash)
    .digest('hex');
}

// Test data - use EXACT values that PayFast would use
const testData = {
  merchant_id: process.env.PAYFAST_MERCHANT_ID,
  merchant_key: process.env.PAYFAST_MERCHANT_KEY,
  return_url: `${process.env.APP_BASE_URL}/payment/success`,
  cancel_url: `${process.env.APP_BASE_URL}/payment/cancel`,
  notify_url: `${process.env.APP_BASE_URL}/payfast/notify`,
  m_payment_id: `test_${Date.now()}`,
  amount: "100.00",
  item_name: "Savings Deposit",
  custom_str1: "test_user"
};

console.log('='.repeat(60));
console.log('🔐 SIGNATURE TEST');
console.log('='.repeat(60));
console.log('Merchant ID:', process.env.PAYFAST_MERCHANT_ID);
console.log('Passphrase:', process.env.PAYFAST_PASSPHRASE ? 'Set' : 'Missing');
console.log('\nTest data:');
Object.keys(testData).sort().forEach(key => {
  console.log(`  ${key}: ${testData[key]}`);
});

const signature = buildPayFastSignature(testData);
console.log('\n✅ Generated signature:', signature);

// Build URL
const queryString = Object.keys(testData)
  .sort()
  .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(testData[key])}`)
  .join("&");

const testUrl = `${process.env.PAYFAST_BASE_URL}?${queryString}&signature=${signature}`;
console.log('\n🔗 Test URL:');
console.log(testUrl);
console.log('='.repeat(60));