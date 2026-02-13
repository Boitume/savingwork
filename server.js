import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Load .env from the current directory
const envPath = path.join(__dirname, '.env');
console.log('📁 Looking for .env at:', envPath);

if (fs.existsSync(envPath)) {
  console.log('✅ Found .env file');
  dotenv.config({ path: envPath });
  
  // Display loaded variables (without sensitive values)
  console.log('📄 Environment variables loaded:');
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    if (line.trim() && !line.startsWith('#')) {
      const [key] = line.split('=');
      if (!key.includes('KEY') && !key.includes('SECRET') && !key.includes('PASSPHRASE')) {
        console.log(`   ${key}=${process.env[key]}`);
      } else {
        console.log(`   ${key}=[HIDDEN]`);
      }
    }
  });
} else {
  console.error('❌ .env file not found at:', envPath);
  console.error('Please create .env file in the same directory as server.js');
  process.exit(1);
}

const app = express();
const PORT = process.env.BACKEND_PORT || 4242;

// ✅ Verify required environment variables
const requiredEnvVars = [
  'VITE_SUPABASE_URL',
  'SUPABASE_SERVICE_KEY',
  'PAYFAST_MERCHANT_ID',
  'PAYFAST_MERCHANT_KEY',
  'PAYFAST_PASSPHRASE',
  'PAYFAST_BASE_URL',
  'APP_BASE_URL'
];

const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingEnvVars.forEach(varName => console.error(`   - ${varName}`));
  console.error('\nPlease check your .env file');
  process.exit(1);
}

console.log('✅ All required environment variables found');
console.log('🔑 PayFast Merchant ID:', process.env.PAYFAST_MERCHANT_ID);
console.log('🔗 PayFast Base URL:', process.env.PAYFAST_BASE_URL);
console.log('🔗 App Base URL:', process.env.APP_BASE_URL);

// ✅ Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ✅ CORS Configuration
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  process.env.APP_BASE_URL,
  /\.ngrok-free\.app$/  // Allow any ngrok URL
].filter(Boolean);

console.log('🌐 Allowed origins:', allowedOrigins.map(o => o.toString()));

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps, curl)
    if (!origin) return callback(null, true);
    
    const allowed = allowedOrigins.some(allowed => 
      typeof allowed === 'string' ? allowed === origin : allowed.test(origin)
    );
    
    if (allowed) {
      callback(null, true);
    } else {
      console.log('❌ Blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "ngrok-skip-browser-warning"],
  credentials: true,
  optionsSuccessStatus: 200
}));

// ✅ Initialize Supabase
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

console.log('✅ Supabase client initialized');

// ✅ Health check
app.get("/", (req, res) => {
  res.json({ 
    status: "Server is running",
    timestamp: new Date().toISOString(),
    environment: {
      node: process.version,
      port: PORT,
      supabase: process.env.VITE_SUPABASE_URL ? 'Connected' : 'Disconnected',
      payfast: process.env.PAYFAST_MERCHANT_ID ? 'Configured' : 'Not configured',
      mode: process.env.PAYFAST_BASE_URL?.includes('sandbox') ? 'SANDBOX' : 'LIVE',
      appBaseUrl: process.env.APP_BASE_URL
    }
  });
});

// ============ TEST ENDPOINTS ============

// Simple ping
app.get("/ping", (req, res) => {
  res.json({ message: "pong", time: Date.now() });
});

// PayFast ping
app.get("/payfast/ping", (req, res) => {
  res.json({ message: "PayFast router is working" });
});

// Simple test endpoint
app.get("/payfast/test-simple", (req, res) => {
  res.json({ 
    message: "PayFast test endpoint",
    merchant_id: process.env.PAYFAST_MERCHANT_ID,
    timestamp: new Date().toISOString()
  });
});

// Debug endpoint - shows all credentials
app.get("/payfast/debug", (req, res) => {
  res.json({
    success: true,
    credentials: {
      merchant_id: process.env.PAYFAST_MERCHANT_ID,
      merchant_key_exists: !!process.env.PAYFAST_MERCHANT_KEY,
      passphrase_exists: !!process.env.PAYFAST_PASSPHRASE,
      base_url: process.env.PAYFAST_BASE_URL,
      app_url: process.env.APP_BASE_URL
    },
    server: {
      port: PORT,
      time: new Date().toISOString()
    }
  });
});

// ============ ULTIMATE PAYFAST DEBUGGER ============
app.get("/payfast/ultimate-debug", (req, res) => {
  try {
    console.log('\n' + '🔬'.repeat(40));
    console.log('🔬 ULTIMATE PAYFAST DEBUGGER');
    console.log('🔬'.repeat(40));
    
    // Step 1: Show raw environment variables
    console.log('\n📋 ENVIRONMENT VARIABLES:');
    console.log(`PAYFAST_MERCHANT_ID: "${process.env.PAYFAST_MERCHANT_ID}" (length: ${process.env.PAYFAST_MERCHANT_ID?.length})`);
    console.log(`PAYFAST_MERCHANT_KEY: "${process.env.PAYFAST_MERCHANT_KEY?.substring(0, 3)}..." (length: ${process.env.PAYFAST_MERCHANT_KEY?.length})`);
    console.log(`PAYFAST_PASSPHRASE: "${process.env.PAYFAST_PASSPHRASE?.substring(0, 3)}..." (length: ${process.env.PAYFAST_PASSPHRASE?.length})`);
    console.log(`PAYFAST_BASE_URL: ${process.env.PAYFAST_BASE_URL}`);
    console.log(`APP_BASE_URL: ${process.env.APP_BASE_URL}`);

    // Step 2: Create test data with explicit string values
    const testData = {
      merchant_id: String(process.env.PAYFAST_MERCHANT_ID || '').trim(),
      merchant_key: String(process.env.PAYFAST_MERCHANT_KEY || '').trim(),
      return_url: String(`${process.env.APP_BASE_URL}/payment/success`).trim(),
      cancel_url: String(`${process.env.APP_BASE_URL}/payment/cancel`).trim(),
      notify_url: String(`${process.env.APP_BASE_URL}/payfast/notify`).trim(),
      m_payment_id: `test_${Date.now()}`,
      amount: "100.00",
      item_name: "Savings Deposit",
      custom_str1: "test_user_123"
    };

    console.log('\n📦 TEST DATA (raw):');
    Object.keys(testData).forEach(key => {
      const value = testData[key];
      console.log(`   ${key}: "${value}" (${typeof value}, length: ${value.length})`);
    });

    // Step 3: Build parameter string PRESERVING ORDER
    console.log('\n🔑 PARAMETER ORDER (preserved):', Object.keys(testData));
    
    const paramPairs = [];
    for (const key of Object.keys(testData)) { // NO SORTING!
      const rawValue = testData[key];
      let encodedValue = encodeURIComponent(rawValue);
      encodedValue = encodedValue.replace(/%20/g, '+');
      paramPairs.push(`${key}=${encodedValue}`);
      console.log(`   ${key}=${encodedValue}`);
    }
    
    const paramString = paramPairs.join('&');
    console.log('\n📝 PARAMETER STRING:');
    console.log(paramString);

    // Step 4: Add passphrase
    const passphrase = String(process.env.PAYFAST_PASSPHRASE || '').trim();
    const stringToHash = paramString + `&passphrase=${passphrase}`;
    console.log('\n🔐 STRING TO HASH:');
    console.log(stringToHash);

    // Step 5: Generate MD5 hash
    const signature = crypto.createHash('md5').update(stringToHash).digest('hex');
    console.log('\n✅ GENERATED SIGNATURE:', signature);

    // Step 6: Build complete URL
    const finalData = { ...testData, signature };
    const finalPairs = [];
    for (const key of Object.keys(finalData)) { // PRESERVE ORDER
      finalPairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(finalData[key])}`);
    }
    const finalUrl = `${process.env.PAYFAST_BASE_URL}?${finalPairs.join('&')}`;

    console.log('\n🔗 COMPLETE URL (for testing):');
    console.log(finalUrl);
    
    console.log('\n🔬'.repeat(40) + '\n');

    res.json({
      success: true,
      debug: {
        environment: {
          merchant_id: process.env.PAYFAST_MERCHANT_ID,
          merchant_key_length: process.env.PAYFAST_MERCHANT_KEY?.length,
          passphrase_length: process.env.PAYFAST_PASSPHRASE?.length,
          base_url: process.env.PAYFAST_BASE_URL,
          app_url: process.env.APP_BASE_URL
        },
        signature_generation: {
          param_order: Object.keys(testData),
          param_string: paramString,
          string_hashed: stringToHash,
          signature: signature
        },
        test_url: finalUrl
      }
    });

  } catch (error) {
    console.error('❌ Debug error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ PAYFAST SIGNATURE GENERATOR - PRESERVES ORDER ============
// ✅ CRITICAL: PayFast requires parameters in the EXACT order they appear in the form
// DO NOT SORT! The order MUST match PayFast's documentation:
// https://developers.payfast.co.za/docs#step1
function generatePayFastSignature(params, passphrase) {
  // Filter out empty values but PRESERVE ORDER
  const orderedParams = {};
  Object.keys(params).forEach(key => {
    if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
      orderedParams[key] = params[key];
    }
  });
  
  // Build parameter string in the EXACT order of the keys as they were added
  // This matches the order in your form/post data
  const paramPairs = [];
  for (const key of Object.keys(orderedParams)) { // NO SORTING HERE!
    const value = String(orderedParams[key]).trim();
    // URL encode and replace %20 with + (PayFast specific)
    const encodedValue = encodeURIComponent(value).replace(/%20/g, '+');
    paramPairs.push(`${key}=${encodedValue}`);
  }
  
  const paramString = paramPairs.join('&');
  
  // Add passphrase
  const cleanPassphrase = String(passphrase).trim();
  const stringToHash = paramString + '&passphrase=' + cleanPassphrase;
  
  // Generate MD5 hash
  const signature = crypto.createHash('md5').update(stringToHash).digest('hex');
  
  console.log('\n🔐 SIGNATURE DEBUG (Order Preserved):');
  console.log('Parameter order:', Object.keys(orderedParams));
  console.log('Parameter string:', paramString);
  console.log('With passphrase:', stringToHash);
  console.log('Signature:', signature);
  
  return {
    signature,
    paramString,
    stringToHash,
    paramOrder: Object.keys(orderedParams)
  };
}

// ============ PAYMENT ENDPOINTS ============

// ✅ CREATE PAYMENT - WITH CORRECT PARAMETER ORDER
app.post("/payfast/create-payment", async (req, res) => {
  try {
    const { amount, userId } = req.body;

    console.log('\n' + '💰'.repeat(30));
    console.log('💰 PAYMENT REQUEST');
    console.log('💰'.repeat(30));
    console.log('Amount:', amount);
    console.log('User ID:', userId);

    // Validate input
    if (!amount || !userId) {
      return res.status(400).json({ 
        error: "Missing required fields",
        required: ["amount", "userId"]
      });
    }

    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    // Generate payment ID
    const paymentId = `pay_${Date.now()}`;

    // IMPORTANT: The order of these properties MUST match PayFast's documentation
    // https://developers.payfast.co.za/docs#step1
    const data = {
      // Merchant details (first)
      merchant_id: String(process.env.PAYFAST_MERCHANT_ID).trim(),
      merchant_key: String(process.env.PAYFAST_MERCHANT_KEY).trim(),
      
      // URLs (second)
      return_url: String(`${process.env.APP_BASE_URL}/payment/success`).trim(),
      cancel_url: String(`${process.env.APP_BASE_URL}/payment/cancel`).trim(),
      notify_url: String(`${process.env.APP_BASE_URL}/payfast/notify`).trim(),
      
      // Transaction details (third)
      m_payment_id: String(paymentId).trim(),
      amount: String(parseFloat(amount).toFixed(2)).trim(),
      item_name: String("Savings Deposit").trim(),
      
      // Custom fields (fourth)
      custom_str1: String(userId).trim()
    };

    console.log('\n📦 Data order (must match PayFast docs):');
    Object.keys(data).forEach((key, index) => {
      if (!key.includes('key') && !key.includes('passphrase')) {
        console.log(`   ${index + 1}. ${key}: ${data[key]}`);
      } else {
        console.log(`   ${index + 1}. ${key}: [HIDDEN]`);
      }
    });

    // Get passphrase
    const passphrase = String(process.env.PAYFAST_PASSPHRASE).trim();

    // Generate signature using order-preserving function
    const { signature } = generatePayFastSignature(data, passphrase);
    
    // Add signature to data
    data.signature = signature;

    // Build final query string - for URL only, we preserve order
    // because the signature already uses the correct order
    const finalPairs = [];
    for (const key of Object.keys(data)) { // PRESERVE ORDER
      finalPairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(data[key])}`);
    }
    const finalQuery = finalPairs.join('&');
    const payfastUrl = `${process.env.PAYFAST_BASE_URL}?${finalQuery}`;

    console.log('\n✅ Payment URL generated');
    console.log('💰'.repeat(30) + '\n');

    // Optional: Store payment in database
    try {
      const { error: insertError } = await supabase
        .from("payments")
        .insert([{
          payment_id: paymentId,
          user_id: userId,
          amount: parseFloat(amount),
          status: "pending",
          created_at: new Date().toISOString()
        }]);

      if (insertError) {
        console.error("⚠️ Could not store payment in database:", insertError.message);
      } else {
        console.log('💾 Payment stored in database');
      }
    } catch (dbError) {
      console.error("⚠️ Database error:", dbError.message);
    }

    // Return payment URL
    res.json({ 
      success: true,
      url: payfastUrl,
      payment_id: paymentId,
      amount: amount
    });

  } catch (error) {
    console.error("❌ Payment error:", error);
    res.status(500).json({ 
      error: "Failed to create payment",
      message: error.message 
    });
  }
});

// ✅ SIGNATURE COMPARISON TOOL
app.post("/payfast/compare-signature", express.text({ type: "*/*" }), (req, res) => {
  try {
    console.log('\n' + '🔍'.repeat(60));
    console.log('🔍 SIGNATURE COMPARISON TOOL');
    console.log('🔍'.repeat(60));
    
    // Parse the incoming data (simulates PayFast webhook)
    const params = Object.fromEntries(
      req.body.split("&").map(pair => {
        const [key, value] = pair.split("=");
        return [key, decodeURIComponent(value || "")];
      })
    );

    console.log('📦 Received params:', JSON.stringify(params, null, 2));

    // Extract signature
    const receivedSignature = params.signature;
    delete params.signature;

    // Clean params (preserve order from the incoming request)
    const cleanParams = {};
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== null) {
        cleanParams[key] = String(params[key]).trim();
      }
    });

    console.log('\n🧹 Cleaned params (order preserved):', Object.keys(cleanParams));

    // Get passphrase
    const passphrase = String(process.env.PAYFAST_PASSPHRASE).trim();

    // Generate expected signature using order-preserving function
    const { signature: expectedSignature, paramString, stringToHash } = generatePayFastSignature(cleanParams, passphrase);

    console.log('\n🔐 SIGNATURE COMPARISON:');
    console.log('Parameter string:', paramString);
    console.log('String hashed:', stringToHash);
    console.log('Received signature:', receivedSignature);
    console.log('Expected signature:', expectedSignature);
    console.log('Match:', receivedSignature === expectedSignature ? '✅ YES' : '❌ NO');

    if (receivedSignature !== expectedSignature) {
      console.log('\n📊 DETAILED COMPARISON:');
      console.log('Received length:', receivedSignature.length);
      console.log('Expected length:', expectedSignature.length);
      
      // Show the difference character by character
      for (let i = 0; i < Math.min(receivedSignature.length, expectedSignature.length); i++) {
        if (receivedSignature[i] !== expectedSignature[i]) {
          console.log(`Position ${i}: '${receivedSignature[i]}' (${receivedSignature.charCodeAt(i)}) vs '${expectedSignature[i]}' (${expectedSignature.charCodeAt(i)})`);
        }
      }
    }

    console.log('🔍'.repeat(60) + '\n');

    res.json({
      received: receivedSignature,
      expected: expectedSignature,
      match: receivedSignature === expectedSignature,
      paramString: paramString,
      stringHashed: stringToHash
    });

  } catch (error) {
    console.error('❌ Comparison error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ TEST PAYMENT ENDPOINT
app.get("/payfast/test-payment", (req, res) => {
  try {
    const testUserId = "test_user_123";
    const testAmount = 100;
    
    // IMPORTANT: Preserve order for test data too
    const data = {
      merchant_id: String(process.env.PAYFAST_MERCHANT_ID).trim(),
      merchant_key: String(process.env.PAYFAST_MERCHANT_KEY).trim(),
      return_url: String(`${process.env.APP_BASE_URL}/test-success`).trim(),
      cancel_url: String(`${process.env.APP_BASE_URL}/test-cancel`).trim(),
      notify_url: String(`${process.env.APP_BASE_URL}/payfast/notify`).trim(),
      m_payment_id: `test_${Date.now()}`,
      amount: testAmount.toFixed(2),
      item_name: "Test Payment",
      custom_str1: testUserId
    };
    
    const passphrase = String(process.env.PAYFAST_PASSPHRASE).trim();
    const { signature, paramString, stringToHash } = generatePayFastSignature(data, passphrase);
    
    data.signature = signature;
    
    const queryString = Object.keys(data)
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(data[key])}`)
      .join("&");
    
    const payfastUrl = `${process.env.PAYFAST_BASE_URL}?${queryString}`;
    
    res.json({
      success: true,
      message: "Test payment URL generated",
      url: payfastUrl,
      merchant_id: process.env.PAYFAST_MERCHANT_ID,
      signature: signature,
      debug: {
        paramString: paramString,
        stringHashed: stringToHash
      }
    });
  } catch (error) {
    console.error("❌ Test payment error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ PAYFAST WEBHOOK (Notify URL)
app.post("/payfast/notify", express.text({ type: "*/*" }), async (req, res) => {
  try {
    console.log("\n📨 WEBHOOK RECEIVED");
    console.log("Raw body:", req.body);

    // Parse the raw body into parameters
    const params = Object.fromEntries(
      req.body.split("&").map(pair => {
        const [key, value] = pair.split("=");
        return [key, decodeURIComponent(value || "")];
      })
    );

    console.log("Parsed params (order preserved):", Object.keys(params));

    // Verify signature
    const receivedSignature = params.signature;
    delete params.signature;
    
    const passphrase = String(process.env.PAYFAST_PASSPHRASE).trim();
    const { signature: expectedSignature } = generatePayFastSignature(params, passphrase);

    if (receivedSignature !== expectedSignature) {
      console.error("❌ Invalid PayFast signature");
      console.log("Received:", receivedSignature);
      console.log("Expected:", expectedSignature);
      return res.status(400).send("Invalid signature");
    }

    console.log("✅ Signature verified");

    // Process payment based on status
    if (params.payment_status === "COMPLETE") {
      const userId = params.custom_str1 || params.custom_int1;
      const amount = parseFloat(params.amount_gross || params.amount);
      const paymentId = params.m_payment_id;

      if (!userId || !amount) {
        console.error("❌ Missing userId or amount in webhook");
        return res.status(400).send("Missing data");
      }

      console.log(`💰 Processing completed payment: User ${userId}, Amount R${amount}`);

      // Update user balance using RPC
      const { error: rpcError } = await supabase
        .rpc("increment_balance", {
          user_id_input: userId,
          amount_input: amount
        });

      if (rpcError) {
        console.error("❌ Error updating balance:", rpcError);
      } else {
        console.log("✅ User balance updated");
      }

      // Record transaction
      const { error: transactionError } = await supabase
        .from("transactions")
        .insert([{
          user_id: userId,
          amount: amount,
          type: "deposit",
          status: "completed",
          payment_id: paymentId,
          reference: params.pf_payment_id,
          created_at: new Date().toISOString()
        }]);

      if (transactionError) {
        console.error("❌ Error recording transaction:", transactionError);
      } else {
        console.log("✅ Transaction recorded");
      }

      console.log(`🎉 Payment completed successfully for user ${userId}: R${amount}`);
    }

    res.status(200).send("OK");
  } catch (error) {
    console.error("❌ Webhook error:", error);
    res.status(500).send("Internal Server Error");
  }
});

// ============ ERROR HANDLING ============

// ✅ 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: "Not found", 
    path: req.url,
    method: req.method
  });
});

// ✅ Error handling middleware
app.use((err, req, res, next) => {
  console.error("❌ Unhandled error:", err);
  res.status(500).json({ 
    error: "Internal server error",
    message: err.message 
  });
});

// ============ START SERVER ============
app.listen(PORT, () => {
  console.log('\n' + '='.repeat(60));
  console.log(`🚀 SERVER STARTED SUCCESSFULLY`);
  console.log('='.repeat(60));
  console.log(`📡 Port: ${PORT}`);
  console.log(`🔗 APP_BASE_URL: ${process.env.APP_BASE_URL}`);
  console.log(`💰 PayFast: ${process.env.PAYFAST_BASE_URL?.includes('sandbox') ? 'SANDBOX' : 'LIVE'}`);
  console.log(`🆔 Merchant ID: ${process.env.PAYFAST_MERCHANT_ID}`);
  console.log('='.repeat(60));
  console.log(`📝 Available endpoints:`);
  console.log(`   GET  http://localhost:${PORT}/`);
  console.log(`   GET  http://localhost:${PORT}/ping`);
  console.log(`   GET  http://localhost:${PORT}/payfast/ping`);
  console.log(`   GET  http://localhost:${PORT}/payfast/test-simple`);
  console.log(`   GET  http://localhost:${PORT}/payfast/debug`);
  console.log(`   GET  http://localhost:${PORT}/payfast/ultimate-debug`);
  console.log(`   GET  http://localhost:${PORT}/payfast/test-payment`);
  console.log(`   POST http://localhost:${PORT}/payfast/create-payment`);
  console.log(`   POST http://localhost:${PORT}/payfast/compare-signature`);
  console.log(`   POST http://localhost:${PORT}/payfast/notify (webhook)`);
  console.log('='.repeat(60) + '\n');
});