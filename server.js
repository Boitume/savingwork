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

// ✅ Load environment variables - Check Render environment first, then fall back to .env file
const isProduction = process.env.NODE_ENV === 'production';

if (!isProduction) {
  // Only try to load .env file in development
  const envPath = path.join(__dirname, '.env');
  console.log('📁 Looking for .env at:', envPath);

  if (fs.existsSync(envPath)) {
    console.log('✅ Found .env file');
    dotenv.config({ path: envPath });
  } else {
    console.log('⚠️ No .env file found, using environment variables');
  }
} else {
  console.log('📁 Production mode: Using environment variables from Render dashboard');
}

// Display loaded variables (without sensitive values)
console.log('📄 Environment variables loaded:');
const envVars = [
  'VITE_SUPABASE_URL',
  'SUPABASE_SERVICE_KEY',
  'PAYFAST_MERCHANT_ID',
  'PAYFAST_MERCHANT_KEY',
  'PAYFAST_PASSPHRASE',
  'PAYFAST_BASE_URL',
  'APP_BASE_URL',
  'VITE_BACKEND_URL',
  'CONTACT_EMAIL'
];

envVars.forEach(key => {
  if (process.env[key]) {
    if (key.includes('KEY') || key.includes('SECRET') || key.includes('PASSPHRASE')) {
      console.log(`   ${key}=[HIDDEN]`);
    } else {
      console.log(`   ${key}=${process.env[key]}`);
    }
  } else {
    console.log(`   ⚠️ ${key} not set`);
  }
});

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
  
  if (isProduction) {
    console.error('\nPlease add these environment variables in your Render dashboard:');
    console.error('https://dashboard.render.com');
    process.exit(1);
  } else {
    console.error('\nPlease create a .env file with these variables');
    process.exit(1);
  }
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
  "http://localhost:4242",
  process.env.APP_BASE_URL,
  /\.ngrok-free\.app$/,
  /\.onrender\.com$/  // Allow Render domains
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
app.get("/api/health", (req, res) => {
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
app.get("/api/ping", (req, res) => {
  res.json({ message: "pong", time: Date.now() });
});

// PayFast ping
app.get("/api/payfast/ping", (req, res) => {
  res.json({ message: "PayFast router is working" });
});

// Simple test endpoint
app.get("/api/payfast/test-simple", (req, res) => {
  res.json({ 
    message: "PayFast test endpoint",
    merchant_id: process.env.PAYFAST_MERCHANT_ID,
    timestamp: new Date().toISOString()
  });
});

// Debug endpoint - shows all credentials
app.get("/api/payfast/debug", (req, res) => {
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
app.get("/api/payfast/ultimate-debug", (req, res) => {
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
function generatePayFastSignature(params, passphrase) {
  // Filter out empty values but PRESERVE ORDER
  const orderedParams = {};
  Object.keys(params).forEach(key => {
    if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
      orderedParams[key] = params[key];
    }
  });
  
  // Build parameter string in the EXACT order of the keys as they were added
  const paramPairs = [];
  for (const key of Object.keys(orderedParams)) { // NO SORTING!
    const value = String(orderedParams[key]).trim();
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

// ✅ CREATE PAYMENT
app.post("/api/payfast/create-payment", async (req, res) => {
  try {
    const { amount, userId } = req.body;

    console.log('\n' + '💰'.repeat(30));
    console.log('💰 PAYMENT REQUEST');
    console.log('💰'.repeat(30));
    console.log('Amount:', amount);
    console.log('User ID:', userId);

    if (!amount || !userId) {
      return res.status(400).json({ 
        error: "Missing required fields",
        required: ["amount", "userId"]
      });
    }

    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    const paymentId = `pay_${Date.now()}`;

    const data = {
      merchant_id: String(process.env.PAYFAST_MERCHANT_ID).trim(),
      merchant_key: String(process.env.PAYFAST_MERCHANT_KEY).trim(),
      return_url: String(`${process.env.APP_BASE_URL}/payment/success`).trim(),
      cancel_url: String(`${process.env.APP_BASE_URL}/payment/cancel`).trim(),
      notify_url: String(`${process.env.APP_BASE_URL}/payfast/notify`).trim(),
      m_payment_id: String(paymentId).trim(),
      amount: String(parseFloat(amount).toFixed(2)).trim(),
      item_name: String("Savings Deposit").trim(),
      custom_str1: String(userId).trim()
    };

    console.log('\n📦 Data order:', Object.keys(data));

    const passphrase = String(process.env.PAYFAST_PASSPHRASE).trim();
    const { signature } = generatePayFastSignature(data, passphrase);
    
    data.signature = signature;

    const finalPairs = [];
    for (const key of Object.keys(data)) {
      finalPairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(data[key])}`);
    }
    const finalQuery = finalPairs.join('&');
    const payfastUrl = `${process.env.PAYFAST_BASE_URL}?${finalQuery}`;

    console.log('\n✅ Payment URL generated');

    // Store payment in database
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
        console.error("⚠️ Could not store payment:", insertError.message);
      } else {
        console.log('💾 Payment stored in database');
      }
    } catch (dbError) {
      console.error("⚠️ Database error:", dbError.message);
    }

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
app.post("/api/payfast/compare-signature", express.text({ type: "*/*" }), (req, res) => {
  try {
    console.log('\n' + '🔍'.repeat(60));
    console.log('🔍 SIGNATURE COMPARISON TOOL');
    console.log('🔍'.repeat(60));
    
    const params = Object.fromEntries(
      req.body.split("&").map(pair => {
        const [key, value] = pair.split("=");
        return [key, decodeURIComponent(value || "")];
      })
    );

    const receivedSignature = params.signature;
    delete params.signature;

    const cleanParams = {};
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== null) {
        cleanParams[key] = String(params[key]).trim();
      }
    });

    const passphrase = String(process.env.PAYFAST_PASSPHRASE).trim();
    const { signature: expectedSignature } = generatePayFastSignature(cleanParams, passphrase);

    res.json({
      received: receivedSignature,
      expected: expectedSignature,
      match: receivedSignature === expectedSignature
    });

  } catch (error) {
    console.error('❌ Comparison error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ TEST PAYMENT ENDPOINT
app.get("/api/payfast/test-payment", (req, res) => {
  try {
    const testUserId = "test_user_123";
    const testAmount = 100;
    
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
    const { signature } = generatePayFastSignature(data, passphrase);
    
    data.signature = signature;
    
    const queryString = Object.keys(data)
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(data[key])}`)
      .join("&");
    
    const payfastUrl = `${process.env.PAYFAST_BASE_URL}?${queryString}`;
    
    res.json({
      success: true,
      url: payfastUrl,
      signature: signature
    });
  } catch (error) {
    console.error("❌ Test payment error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ ENHANCED PAYFAST WEBHOOK (Notify URL) - WITH FULL DEBUGGING
app.post("/api/payfast/notify", express.text({ type: "*/*" }), async (req, res) => {
  try {
    console.log("\n" + "=".repeat(60));
    console.log("📨 WEBHOOK RECEIVED - START");
    console.log("=".repeat(60));
    console.log("📝 Raw body:", req.body);
    console.log("📝 Headers:", JSON.stringify(req.headers, null, 2));

    // Parse the raw body into parameters
    let params;
    try {
      params = Object.fromEntries(
        req.body.split("&").map(pair => {
          const [key, value] = pair.split("=");
          return [key, decodeURIComponent(value || "")];
        })
      );
      console.log("📦 Parsed params:", JSON.stringify(params, null, 2));
    } catch (parseError) {
      console.error("❌ Failed to parse webhook body:", parseError);
      return res.status(400).send("Invalid body format");
    }

    // Verify signature
    const receivedSignature = params.signature;
    delete params.signature;
    
    const passphrase = String(process.env.PAYFAST_PASSPHRASE).trim();
    const { signature: expectedSignature } = generatePayFastSignature(params, passphrase);

    console.log("🔐 Signature comparison:");
    console.log("   Received:", receivedSignature);
    console.log("   Expected:", expectedSignature);
    console.log("   Match:", receivedSignature === expectedSignature ? "✅ YES" : "❌ NO");

    if (receivedSignature !== expectedSignature) {
      console.error("❌ Invalid PayFast signature");
      return res.status(400).send("Invalid signature");
    }

    console.log("✅ Signature verified");

    if (params.payment_status === "COMPLETE") {
      const userId = params.custom_str1 || params.custom_int1;
      const amount = parseFloat(params.amount_gross || params.amount);
      const paymentId = params.m_payment_id;
      const pfPaymentId = params.pf_payment_id;

      console.log(`💰 Processing payment:`);
      console.log(`   User ID: ${userId}`);
      console.log(`   Amount: R${amount}`);
      console.log(`   Payment ID: ${paymentId}`);
      console.log(`   PF Payment ID: ${pfPaymentId}`);

      if (!userId || !amount) {
        console.error("❌ Missing userId or amount");
        return res.status(400).send("Missing data");
      }

      // Check if user exists first
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, balance')
        .eq('id', userId)
        .single();

      if (userError) {
        console.error("❌ User not found:", userError);
        return res.status(400).send("User not found");
      }

      console.log(`   Current balance: R${user.balance || 0}`);

      // Update user balance using RPC
      console.log("🔄 Calling increment_balance RPC...");
      const { data: rpcData, error: rpcError } = await supabase
        .rpc("increment_balance", {
          user_id_input: userId,
          amount_input: amount
        });

      if (rpcError) {
        console.error("❌ RPC Error:", rpcError);
        
        // Fallback: Try direct update if RPC fails
        console.log("🔄 Attempting direct update as fallback...");
        const { data: updateData, error: updateError } = await supabase
          .from('users')
          .update({ balance: user.balance + amount })
          .eq('id', userId)
          .select();

        if (updateError) {
          console.error("❌ Direct update also failed:", updateError);
          return res.status(500).send("Failed to update balance");
        } else {
          console.log("✅ Direct update succeeded:", updateData);
        }
      } else {
        console.log("✅ RPC succeeded:", rpcData);
      }

      // Get updated balance
      const { data: updatedUser, error: fetchError } = await supabase
        .from('users')
        .select('balance')
        .eq('id', userId)
        .single();

      console.log(`💰 New balance: R${updatedUser?.balance || 0}`);

      // Record transaction
      console.log("🔄 Recording transaction...");
      const { data: transactionData, error: transactionError } = await supabase
        .from("transactions")
        .insert([{
          user_id: userId,
          amount: amount,
          type: "deposit",
          status: "completed",
          payment_id: paymentId,
          reference: pfPaymentId,
          created_at: new Date().toISOString()
        }])
        .select();

      if (transactionError) {
        console.error("❌ Transaction error:", transactionError);
      } else {
        console.log("✅ Transaction recorded:", transactionData);
      }

      // Update payment status
      console.log("🔄 Updating payment record...");
      const { data: paymentData, error: paymentError } = await supabase
        .from("payments")
        .update({ 
          status: "completed",
          completed_at: new Date().toISOString(),
          transaction_id: pfPaymentId
        })
        .eq("payment_id", paymentId)
        .select();

      if (paymentError) {
        console.error("❌ Payment update error:", paymentError);
      } else {
        console.log("✅ Payment updated:", paymentData);
      }

      console.log(`🎉 Payment completed successfully for user ${userId}: R${amount}`);
    } else {
      console.log(`ℹ️ Payment status: ${params.payment_status}`);
    }

    console.log("=".repeat(60) + "\n");
    res.status(200).send("OK");
  } catch (error) {
    console.error("❌ Webhook error:", error);
    console.log("=".repeat(60) + "\n");
    res.status(500).send("Internal Server Error");
  }
});

// ✅ DIAGNOSTIC ENDPOINT - Check Supabase connection and RPC function
app.get("/api/diagnostic", async (req, res) => {
  try {
    console.log("\n🔧 DIAGNOSTIC CHECK");
    console.log("=".repeat(60));
    
    const results = {
      server: {
        time: new Date().toISOString(),
        node_version: process.version,
        environment: isProduction ? 'production' : 'development'
      },
      supabase: {
        connected: false,
        tables: {},
        rpc_function: null
      },
      payfast: {
        configured: !!process.env.PAYFAST_MERCHANT_ID,
        merchant_id: process.env.PAYFAST_MERCHANT_ID,
        base_url: process.env.PAYFAST_BASE_URL
      }
    };

    // Test Supabase connection
    console.log("📊 Testing Supabase connection...");
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('count', { count: 'exact', head: true });

    results.supabase.connected = !usersError;
    results.supabase.tables.users = usersError ? `❌ ${usersError.message}` : '✅ Connected';

    if (usersError) {
      console.error("❌ Supabase connection error:", usersError);
    } else {
      console.log("✅ Supabase connected successfully");
    }

    // Test RPC function
    console.log("\n📊 Testing increment_balance RPC function...");
    const testUserId = req.query.userId || '00000000-0000-0000-0000-000000000000';
    const { error: rpcError } = await supabase
      .rpc('increment_balance', {
        user_id_input: testUserId,
        amount_input: 0
      });

    results.supabase.rpc_function = !rpcError ? '✅ Exists' : `❌ ${rpcError.message}`;
    
    if (rpcError) {
      console.log("ℹ️ RPC function check:", rpcError.message);
    } else {
      console.log("✅ RPC function exists");
    }

    // Get recent transactions
    console.log("\n📊 Checking recent transactions...");
    const { data: recentTransactions, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    if (!txError) {
      results.supabase.recent_transactions = recentTransactions;
      console.log(`✅ Found ${recentTransactions.length} recent transactions`);
    }

    console.log("\n✅ Diagnostic complete");
    console.log("=".repeat(60) + "\n");

    res.json({
      success: true,
      ...results,
      instructions: {
        test_webhook: `/api/payfast/test-notify?userId=YOUR_USER_ID&amount=100`,
        view_logs: "Check Render logs for detailed webhook output",
        create_rpc: "If RPC function is missing, run this SQL in Supabase: CREATE OR REPLACE FUNCTION increment_balance(user_id_input UUID, amount_input DECIMAL) RETURNS void AS $$ BEGIN UPDATE users SET balance = COALESCE(balance, 0) + amount_input WHERE id = user_id_input; END; $$ LANGUAGE plpgsql SECURITY DEFINER;"
      }
    });

  } catch (error) {
    console.error("❌ Diagnostic error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============ TEST WEBHOOK ENDPOINTS ============

// ✅ TEST WEBHOOK - POST version
app.post("/api/payfast/test-notify", express.urlencoded({ extended: true }), async (req, res) => {
  try {
    console.log("\n" + "=".repeat(60));
    console.log("🧪 TEST WEBHOOK RECEIVED (POST)");
    console.log("=".repeat(60));
    
    const { userId, amount = 100 } = req.body;
    
    if (!userId) {
      return res.status(400).json({ 
        error: "Missing userId",
        instruction: "Send POST with { userId: 'your_user_id', amount: 100 }"
      });
    }

    console.log(`📦 Test payload - User: ${userId}, Amount: R${amount}`);

    // Check if user exists
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, balance, username')
      .eq('id', userId)
      .single();

    if (userError) {
      console.error("❌ User not found:", userError);
      return res.status(404).json({ error: "User not found", details: userError });
    }

    console.log(`👤 User found: ${user.username}, Current balance: R${user.balance || 0}`);

    // Update user balance using RPC
    const { data: rpcData, error: rpcError } = await supabase
      .rpc("increment_balance", {
        user_id_input: userId,
        amount_input: parseFloat(amount)
      });

    if (rpcError) {
      console.error("❌ Error updating balance:", rpcError);
      
      // Fallback: direct update
      console.log("🔄 Trying direct update...");
      const { error: directError } = await supabase
        .from('users')
        .update({ balance: (user.balance || 0) + parseFloat(amount) })
        .eq('id', userId);

      if (directError) {
        console.error("❌ Direct update failed:", directError);
        return res.status(500).json({ error: "Failed to update balance", details: directError });
      }
    }

    // Get updated balance
    const { data: updatedUser, error: fetchError } = await supabase
      .from('users')
      .select('balance')
      .eq('id', userId)
      .single();

    // Record transaction
    const paymentId = `test_${Date.now()}`;
    const { error: transactionError } = await supabase
      .from("transactions")
      .insert([{
        user_id: userId,
        amount: parseFloat(amount),
        type: "deposit",
        provider: "payfast_test",
        status: "completed",
        payment_id: paymentId,
        reference: `test_${Date.now()}`,
        created_at: new Date().toISOString()
      }]);

    if (transactionError) {
      console.error("❌ Error recording transaction:", transactionError);
    } else {
      console.log("✅ Transaction recorded");
    }

    console.log(`✅ Test payment completed for user ${userId}: R${amount}`);
    console.log(`💰 New balance: R${updatedUser?.balance || 0}`);
    console.log("=".repeat(60) + "\n");

    res.json({ 
      success: true, 
      message: "Test webhook processed successfully",
      userId,
      amount,
      oldBalance: user.balance || 0,
      newBalance: updatedUser?.balance || 0
    });

  } catch (error) {
    console.error("❌ Test webhook error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ TEST WEBHOOK - GET version for easy browser testing
app.get("/api/payfast/test-notify", async (req, res) => {
  try {
    console.log("\n" + "=".repeat(60));
    console.log("🧪 TEST WEBHOOK RECEIVED (GET)");
    console.log("=".repeat(60));
    
    const { userId, amount = 100 } = req.query;
    
    if (!userId) {
      return res.status(400).json({ 
        error: "Missing userId parameter",
        instruction: "Visit: /api/payfast/test-notify?userId=YOUR_USER_ID&amount=100"
      });
    }

    console.log(`📦 Test payload - User: ${userId}, Amount: R${amount}`);

    // Check if user exists
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, balance, username')
      .eq('id', userId)
      .single();

    if (userError) {
      console.error("❌ User not found:", userError);
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head><title>Error</title></head>
        <body>
          <h1>❌ User Not Found</h1>
          <p>User ID: ${userId}</p>
          <p>Error: ${userError.message}</p>
          <a href="/">Return to Dashboard</a>
        </body>
        </html>
      `);
    }

    console.log(`👤 User found: ${user.username}, Current balance: R${user.balance || 0}`);

    // Update user balance using RPC
    const { error: rpcError } = await supabase
      .rpc("increment_balance", {
        user_id_input: userId,
        amount_input: parseFloat(amount)
      });

    if (rpcError) {
      console.error("❌ RPC Error:", rpcError);
      
      // Fallback: direct update
      console.log("🔄 Trying direct update...");
      const { error: directError } = await supabase
        .from('users')
        .update({ balance: (user.balance || 0) + parseFloat(amount) })
        .eq('id', userId);

      if (directError) {
        console.error("❌ Direct update failed:", directError);
        throw directError;
      }
    }

    // Get updated balance
    const { data: updatedUser, error: fetchError } = await supabase
      .from('users')
      .select('balance')
      .eq('id', userId)
      .single();

    // Record transaction
    const paymentId = `test_${Date.now()}`;
    await supabase
      .from("transactions")
      .insert([{
        user_id: userId,
        amount: parseFloat(amount),
        type: "deposit",
        provider: "payfast_test",
        status: "completed",
        payment_id: paymentId,
        reference: `test_${Date.now()}`,
        created_at: new Date().toISOString()
      }]);

    console.log(`✅ Test payment completed for user ${userId}: R${amount}`);
    console.log(`💰 New balance: R${updatedUser?.balance || 0}`);
    console.log("=".repeat(60) + "\n");

    // Return HTML for browser testing
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Payment Test - Success</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          }
          .card {
            background: white;
            padding: 2.5rem;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            text-align: center;
            max-width: 400px;
            width: 90%;
          }
          h1 {
            color: #059669;
            font-size: 2rem;
            margin-bottom: 1rem;
          }
          .success-icon {
            width: 80px;
            height: 80px;
            background: #10b981;
            color: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 3rem;
            margin: 0 auto 1.5rem;
            box-shadow: 0 10px 20px rgba(16,185,129,0.3);
          }
          .info {
            background: #f3f4f6;
            border-radius: 12px;
            padding: 1rem;
            margin: 1.5rem 0;
            text-align: left;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            padding: 0.5rem 0;
            border-bottom: 1px solid #e5e7eb;
          }
          .info-row:last-child {
            border-bottom: none;
          }
          .label {
            color: #6b7280;
            font-weight: 500;
          }
          .value {
            color: #059669;
            font-weight: 600;
          }
          .balance {
            font-size: 2rem;
            font-weight: bold;
            color: #059669;
            margin: 1rem 0;
          }
          .button {
            background: #059669;
            color: white;
            padding: 0.75rem 2rem;
            border-radius: 10px;
            text-decoration: none;
            display: inline-block;
            margin-top: 1rem;
            font-weight: 500;
            transition: all 0.3s ease;
          }
          .button:hover {
            background: #047857;
            transform: scale(1.05);
            box-shadow: 0 10px 20px rgba(5,150,105,0.3);
          }
          .note {
            color: #9ca3af;
            font-size: 0.875rem;
            margin-top: 1rem;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="success-icon">✓</div>
          <h1>Test Payment Successful!</h1>
          
          <div class="info">
            <div class="info-row">
              <span class="label">Username:</span>
              <span class="value">${user.username}</span>
            </div>
            <div class="info-row">
              <span class="label">User ID:</span>
              <span class="value">${userId}</span>
            </div>
            <div class="info-row">
              <span class="label">Amount Added:</span>
              <span class="value">R${amount}</span>
            </div>
            <div class="info-row">
              <span class="label">Previous Balance:</span>
              <span class="value">R${user.balance || 0}</span>
            </div>
            <div class="info-row">
              <span class="label">New Balance:</span>
              <span class="value">R${updatedUser?.balance || 0}</span>
            </div>
          </div>

          <div class="balance">
            R${updatedUser?.balance || 0}
          </div>

          <a href="/" class="button">Return to Dashboard</a>
          
          <p class="note">
            ✅ Balance updated successfully! Check your dashboard.
          </p>
        </div>
      </body>
      </html>
    `);

  } catch (error) {
    console.error("❌ Test webhook error:", error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Payment Test - Error</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%);
          }
          .card {
            background: white;
            padding: 2.5rem;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            text-align: center;
            max-width: 400px;
            width: 90%;
          }
          .error-icon {
            width: 80px;
            height: 80px;
            background: #ef4444;
            color: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 3rem;
            margin: 0 auto 1.5rem;
          }
          h1 {
            color: #b91c1c;
            font-size: 2rem;
            margin-bottom: 1rem;
          }
          .error-message {
            background: #fee2e2;
            color: #b91c1c;
            padding: 1rem;
            border-radius: 8px;
            margin: 1rem 0;
            word-break: break-word;
          }
          .button {
            background: #6b7280;
            color: white;
            padding: 0.75rem 2rem;
            border-radius: 10px;
            text-decoration: none;
            display: inline-block;
            margin-top: 1rem;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="error-icon">✗</div>
          <h1>Test Failed</h1>
          <div class="error-message">
            ${error.message}
          </div>
          <a href="/" class="button">Go Back</a>
        </div>
      </body>
      </html>
    `);
  }
});

// ✅ DEBUG WEBHOOK ENDPOINT - Shows recent webhook activity
app.get("/api/payfast/webhook-status", async (req, res) => {
  try {
    // Get recent transactions from the last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .eq('provider', 'payfast')
      .gte('created_at', oneDayAgo)
      .order('created_at', { ascending: false })
      .limit(20);

    // Get recent payments
    const { data: payments, error: pmError } = await supabase
      .from('payments')
      .select('*')
      .gte('created_at', oneDayAgo)
      .order('created_at', { ascending: false })
      .limit(20);

    // Get webhook configuration info
    const webhookInfo = {
      endpoint: `${process.env.APP_BASE_URL}/api/payfast/notify`,
      method: 'POST',
      expected_format: 'application/x-www-form-urlencoded',
      recent_transactions: transactions || [],
      recent_payments: payments || [],
      supabase_connected: !!supabase,
      server_time: new Date().toISOString(),
      payfast_configured: {
        merchant_id: !!process.env.PAYFAST_MERCHANT_ID,
        merchant_key: !!process.env.PAYFAST_MERCHANT_KEY,
        passphrase: !!process.env.PAYFAST_PASSPHRASE
      }
    };

    res.json({
      success: true,
      webhook: webhookInfo,
      instructions: {
        test_get: `/api/payfast/test-notify?userId=YOUR_USER_ID&amount=100`,
        test_post: `/api/payfast/test-notify (POST with JSON body)`,
        diagnostic: `/api/diagnostic`,
        check_webhook: `Make sure PayFast is configured to send to: ${webhookInfo.endpoint}`
      }
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ SERVE FRONTEND STATIC FILES ============

const distPath = path.join(__dirname, 'dist');

// isProduction is already defined at the top of the file
if (isProduction) {
  console.log(`\n📦 Production mode: Serving static files from ${distPath}`);
  
  // Check if dist folder exists
  if (fs.existsSync(distPath)) {
    // Serve static files
    app.use(express.static(distPath));
    
    // Handle client-side routing - FIXED VERSION
    // This middleware checks if the request is for an API route
    app.use((req, res, next) => {
      // If it's an API route, skip and let the API handlers deal with it
      if (req.path.startsWith('/api')) {
        return next();
      }
      
      // For all other routes, serve the React app
      res.sendFile(path.join(distPath, 'index.html'));
    });
    
    console.log('✅ Static file serving enabled');
  } else {
    console.error('❌ dist folder not found! Run npm run build first');
  }
} else {
  console.log(`\n🔄 Development mode: API only, frontend running on Vite dev server`);
}

// ============ ERROR HANDLING ============
app.use((req, res) => {
  // Only return 404 for API routes in production
  if (req.path.startsWith('/api')) {
    res.status(404).json({ 
      error: "API endpoint not found", 
      path: req.url
    });
  } else if (!isProduction) {
    // In development, let Vite handle non-API routes
    res.status(404).json({ 
      error: "Not found - in development, frontend is handled by Vite", 
      path: req.url 
    });
  }
  // In production, non-API routes are handled by the middleware above
});

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
  console.log(`🌍 Mode: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
  console.log('='.repeat(60));
  console.log(`📝 API Endpoints:`);
  console.log(`   GET  http://localhost:${PORT}/api/health`);
  console.log(`   GET  http://localhost:${PORT}/api/ping`);
  console.log(`   GET  http://localhost:${PORT}/api/diagnostic`);
  console.log(`   GET  http://localhost:${PORT}/api/payfast/debug`);
  console.log(`   GET  http://localhost:${PORT}/api/payfast/test-notify`);
  console.log(`   POST http://localhost:${PORT}/api/payfast/test-notify`);
  console.log(`   GET  http://localhost:${PORT}/api/payfast/webhook-status`);
  console.log(`   POST http://localhost:${PORT}/api/payfast/create-payment`);
  console.log(`   POST http://localhost:${PORT}/api/payfast/notify (webhook)`);
  
  if (!isProduction) {
    console.log(`\n🎨 Frontend:`);
    console.log(`   http://localhost:5173 (Vite dev server)`);
  } else {
    console.log(`\n🎨 Frontend:`);
    console.log(`   ${process.env.APP_BASE_URL}`);
  }
  console.log('='.repeat(60) + '\n');
});