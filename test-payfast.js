import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Load .env from the current directory
const envPath = path.join(__dirname, '.env');
console.log('📁 Loading .env from:', envPath);

if (fs.existsSync(envPath)) {
  console.log('✅ Found .env file');
  dotenv.config({ path: envPath });
  
  // Show the file content (without sensitive values)
  console.log('\n📄 .env file contents:');
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach(line => {
    if (line.trim() && !line.startsWith('#')) {
      const [key] = line.split('=');
      console.log(`   ${key}=...`);
    }
  });
} else {
  console.error('❌ .env file not found!');
  process.exit(1);
}

function buildPayFastSignature(params) {
  const orderedKeys = Object.keys(params).sort();
  const paramString = orderedKeys
    .map(key => `${key}=${encodeURIComponent(params[key]).replace(/%20/g, "+")}`)
    .join("&");

  if (process.env.PAYFAST_PASSPHRASE) {
    return crypto
      .createHash("md5")
      .update(paramString + `&passphrase=${process.env.PAYFAST_PASSPHRASE}`)
      .digest("hex");
  }
  return crypto.createHash("md5").update(paramString).digest("hex");
}

console.log('\n🧪 Testing PayFast credentials...\n');

console.log('Environment variables:');
console.log('PAYFAST_MERCHANT_ID:', process.env.PAYFAST_MERCHANT_ID || '❌ Missing');
console.log('PAYFAST_MERCHANT_KEY:', process.env.PAYFAST_MERCHANT_KEY ? '✅ Set' : '❌ Missing');
console.log('PAYFAST_PASSPHRASE:', process.env.PAYFAST_PASSPHRASE ? '✅ Set' : '❌ Missing');
console.log('PAYFAST_BASE_URL:', process.env.PAYFAST_BASE_URL || '❌ Missing');
console.log('APP_BASE_URL:', process.env.APP_BASE_URL || '❌ Missing');

if (!process.env.PAYFAST_MERCHANT_ID) {
  console.log('\n❌ PayFast credentials are missing!');
  process.exit(1);
}

// Test data
const testData = {
  merchant_id: process.env.PAYFAST_MERCHANT_ID,
  merchant_key: process.env.PAYFAST_MERCHANT_KEY,
  return_url: `${process.env.APP_BASE_URL}/test`,
  cancel_url: `${process.env.APP_BASE_URL}/test`,
  notify_url: `${process.env.APP_BASE_URL}/test`,
  m_payment_id: `test_${Date.now()}`,
  amount: "100.00",
  item_name: "Test Payment"
};

console.log('\n📦 Test data prepared');
console.log('🔏 Generating signature...');

const signature = buildPayFastSignature(testData);
console.log('✅ Signature generated:', signature);

const queryString = Object.keys(testData)
  .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(testData[key])}`)
  .join("&");

const testUrl = `${process.env.PAYFAST_BASE_URL}?${queryString}&signature=${signature}`;
console.log('\n🔗 Test URL (copy and open in browser):');
console.log(testUrl);