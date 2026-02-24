import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from 'url';
import fs from 'fs';
import { 
  generateRegistrationOptions, 
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse 
} from '@simplewebauthn/server';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Load environment variables
const isProduction = process.env.NODE_ENV === 'production';

if (!isProduction) {
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
  'CONTACT_EMAIL',
  'RP_ID',
  'RP_NAME',
  'ORIGIN'
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
    console.error('\n⚠️ Starting server anyway - but some features may not work!');
    console.error('Please add these variables in your Render dashboard:');
    console.error('https://dashboard.render.com');
    // Don't exit, just warn
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

// ============ WEBAUTHN (FINGERPRINT) CONFIGURATION ============
const challenges = new Map();

const rpID = process.env.RP_ID || (isProduction ? 'savingwork.onrender.com' : 'localhost');
const expectedOrigin = process.env.ORIGIN || (isProduction ? 'https://savingwork.onrender.com' : 'http://localhost:5173');
const rpName = process.env.RP_NAME || 'Face Recognition App';

console.log(`🔐 WebAuthn configured with RP ID: ${rpID}, Origin: ${expectedOrigin}`);

// ============ PURE BIOMETRIC WEBAUTHN ENDPOINTS ============

// ✅ CHECK IF ANY DEVICES EXIST
app.get('/api/webauthn/has-devices', async (req, res) => {
  try {
    const { count, error } = await supabase
      .from('user_credentials')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error('❌ Failed to check devices:', error);
      return res.status(500).json({ error: 'Failed to check devices' });
    }

    res.json({ hasDevices: count > 0 });
  } catch (error) {
    console.error('❌ Error checking devices:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ REGISTRATION BEGIN - FOR NEW USERS (no userId required)
app.post('/api/webauthn/register/begin', async (req, res) => {
  try {
    console.log('🔐 Starting WebAuthn registration for new user');

    // Generate a temporary user ID
    const tempUserId = `temp_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    const tempUsername = `user_${Date.now().toString().slice(-6)}`;

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: tempUserId,
      userName: tempUsername,
      userDisplayName: 'User',
      attestationType: 'none',
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'required',
      },
      supportedAlgorithmIDs: [-7, -257],
    });

    const challengeId = crypto.randomBytes(16).toString('hex');
    challenges.set(challengeId, {
      challenge: options.challenge,
      tempUserId,
      tempUsername,
      timestamp: Date.now()
    });

    console.log(`✅ Registration options generated with challenge ID: ${challengeId}`);
    res.json({ 
      ...options, 
      challengeId 
    });
  } catch (error) {
    console.error('❌ WebAuthn registration begin error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ COMPLETE REGISTRATION (create new user)
app.post('/api/webauthn/register/complete', async (req, res) => {
  try {
    const { credential, challengeId } = req.body;
    
    if (!credential || !challengeId) {
      return res.status(400).json({ error: 'Missing credential or challengeId' });
    }

    console.log(`🔐 Completing WebAuthn registration, challenge ID: ${challengeId}`);

    const storedData = challenges.get(challengeId);
    if (!storedData) {
      return res.status(400).json({ error: 'No registration session found' });
    }

    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge: storedData.challenge,
      expectedOrigin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });

    const { verified, registrationInfo } = verification;

    if (verified && registrationInfo) {
      // Create a new user in the database
      const { data: newUser, error: userError } = await supabase
        .from('users')
        .insert({
          username: storedData.tempUsername,
          email: null,
          balance: 0,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (userError) {
        console.error('❌ Failed to create user:', userError);
        return res.status(500).json({ error: 'Failed to create user' });
      }

      // Store credential in database
      const { error: dbError } = await supabase
        .from('user_credentials')
        .insert({
          user_id: newUser.id,
          credential_id: Buffer.from(registrationInfo.credentialID).toString('base64'),
          public_key: registrationInfo.credentialPublicKey.toString('base64'),
          counter: registrationInfo.counter,
          device_type: registrationInfo.credentialDeviceType,
          backed_up: registrationInfo.credentialBackedUp,
          transports: credential.response.transports || ['internal'],
          created_at: new Date().toISOString()
        });

      if (dbError) {
        console.error('❌ Failed to store credential:', dbError);
        return res.status(500).json({ error: 'Failed to store credential' });
      }

      console.log(`✅ WebAuthn registration successful for new user: ${newUser.id}`);
      
      challenges.delete(challengeId);
      
      res.json({ 
        verified: true,
        user: newUser
      });
    } else {
      console.log('❌ WebAuthn registration verification failed');
      res.status(400).json({ verified: false });
    }
  } catch (error) {
    console.error('❌ WebAuthn registration complete error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ LOGIN BEGIN - PURE BIOMETRIC (no userId required)
app.post('/api/webauthn/login/begin', async (req, res) => {
  try {
    console.log('🔐 Starting WebAuthn authentication (pure biometric)');

    // Get ALL credentials from database
    const { data: credentials, error: dbError } = await supabase
      .from('user_credentials')
      .select('credential_id, transports');

    if (dbError) {
      console.error('❌ Failed to fetch credentials:', dbError);
      return res.status(500).json({ error: 'Failed to fetch credentials' });
    }

    if (!credentials || credentials.length === 0) {
      return res.status(404).json({ error: 'No registered devices found' });
    }

    const allowCredentials = credentials.map(cred => ({
      id: Buffer.from(cred.credential_id, 'base64'),
      type: 'public-key',
      transports: cred.transports || ['internal', 'hybrid', 'usb', 'nfc', 'ble'],
    }));

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials,
      userVerification: 'required',
    });

    const challengeId = crypto.randomBytes(16).toString('hex');
    challenges.set(challengeId, {
      challenge: options.challenge,
      timestamp: Date.now()
    });

    console.log(`✅ Authentication options generated with challenge ID: ${challengeId}`);
    res.json({ ...options, challengeId });
  } catch (error) {
    console.error('❌ WebAuthn authentication begin error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ LOGIN COMPLETE - VERIFY AND RETURN USER
app.post('/api/webauthn/login/complete', async (req, res) => {
  try {
    const { credential, challengeId } = req.body;
    
    if (!credential || !challengeId) {
      return res.status(400).json({ error: 'Missing credential or challengeId' });
    }

    console.log(`🔐 Completing WebAuthn authentication, challenge ID: ${challengeId}`);

    const storedData = challenges.get(challengeId);
    if (!storedData) {
      return res.status(400).json({ error: 'No authentication session found' });
    }

    const credentialId = Buffer.from(credential.id, 'base64').toString('base64');
    const { data: storedCredential, error: dbError } = await supabase
      .from('user_credentials')
      .select('*, users(*)')
      .eq('credential_id', credentialId)
      .single();

    if (dbError || !storedCredential) {
      console.error('❌ Credential not found:', dbError);
      return res.status(404).json({ error: 'Credential not found' });
    }

    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge: storedData.challenge,
      expectedOrigin,
      expectedRPID: rpID,
      credential: {
        id: storedCredential.credential_id,
        publicKey: Buffer.from(storedCredential.public_key, 'base64'),
        counter: storedCredential.counter,
        transports: storedCredential.transports,
      },
      requireUserVerification: true,
    });

    const { verified, authenticationInfo } = verification;

    if (verified && authenticationInfo) {
      // Update counter
      await supabase
        .from('user_credentials')
        .update({ 
          counter: authenticationInfo.newCounter,
          last_used: new Date().toISOString()
        })
        .eq('credential_id', credentialId);

      console.log(`✅ WebAuthn authentication successful for user: ${storedCredential.users.id}`);
      
      challenges.delete(challengeId);
      
      res.json({ 
        verified: true,
        user: storedCredential.users
      });
    } else {
      console.log('❌ WebAuthn authentication verification failed');
      res.status(400).json({ verified: false });
    }
  } catch (error) {
    console.error('❌ WebAuthn authentication complete error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ GET USER'S REGISTERED DEVICES
app.get('/api/webauthn/devices/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const { data: devices, error } = await supabase
      .from('user_credentials')
      .select('id, device_type, backed_up, created_at, last_used, transports')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Failed to fetch devices:', error);
      return res.status(500).json({ error: 'Failed to fetch devices' });
    }

    res.json({ devices });
  } catch (error) {
    console.error('❌ Error fetching devices:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ REMOVE A DEVICE
app.delete('/api/webauthn/devices/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { userId } = req.body;

    const { error } = await supabase
      .from('user_credentials')
      .delete()
      .eq('id', deviceId)
      .eq('user_id', userId);

    if (error) {
      console.error('❌ Failed to delete device:', error);
      return res.status(500).json({ error: 'Failed to delete device' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error deleting device:', error);
    res.status(500).json({ error: error.message });
  }
});

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
      appBaseUrl: process.env.APP_BASE_URL,
      webauthn: {
        rpID,
        origin: expectedOrigin,
        configured: true
      }
    }
  });
});

// ============ PAYFAST SIGNATURE GENERATOR ============
function generatePayFastSignature(params, passphrase) {
  const orderedParams = {};
  Object.keys(params).forEach(key => {
    if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
      orderedParams[key] = params[key];
    }
  });
  
  const paramPairs = [];
  for (const key of Object.keys(orderedParams)) {
    const value = String(orderedParams[key]).trim();
    const encodedValue = encodeURIComponent(value).replace(/%20/g, '+');
    paramPairs.push(`${key}=${encodedValue}`);
  }
  
  const paramString = paramPairs.join('&');
  const cleanPassphrase = String(passphrase).trim();
  const stringToHash = paramString + '&passphrase=' + cleanPassphrase;
  const signature = crypto.createHash('md5').update(stringToHash).digest('hex');
  
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
    const { amount, userId, paymentMethod, voucherCode } = req.body;

    console.log('\n' + '💰'.repeat(30));
    console.log('💰 PAYMENT REQUEST');
    console.log('💰'.repeat(30));
    console.log('Amount:', amount);
    console.log('User ID:', userId);
    console.log('Payment Method:', paymentMethod || 'payfast');
    console.log('Voucher Code:', voucherCode || 'none');

    if (!amount || !userId) {
      return res.status(400).json({ 
        error: "Missing required fields",
        required: ["amount", "userId"]
      });
    }

    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    // If paying with voucher, handle it directly
    if (paymentMethod === 'voucher') {
      if (!voucherCode) {
        return res.status(400).json({ error: "Voucher code required" });
      }

      console.log(`🎫 Processing voucher payment with code: ${voucherCode}`);

      const { data: voucher, error: voucherError } = await supabase
        .from('vouchers')
        .select('*')
        .eq('code', voucherCode)
        .eq('status', 'active')
        .single();

      if (voucherError || !voucher) {
        console.error("❌ Invalid voucher:", voucherError);
        return res.status(400).json({ error: "Invalid voucher code" });
      }

      if (voucher.balance < amount) {
        return res.status(400).json({ 
          error: "Insufficient voucher balance",
          available: voucher.balance
        });
      }

      const { data: user, error: userError } = await supabase
        .from('users')
        .select('balance')
        .eq('id', userId)
        .single();

      if (userError) {
        console.error("❌ User not found:", userError);
        return res.status(404).json({ error: "User not found" });
      }

      const newUserBalance = (user.balance || 0) + amount;

      const { error: updateError } = await supabase.rpc('process_voucher_payment', {
        p_user_id: userId,
        p_amount: amount,
        p_voucher_id: voucher.id,
        p_voucher_code: voucherCode
      });

      if (updateError) {
        console.error("❌ Voucher payment failed:", updateError);
        return res.status(500).json({ error: "Payment processing failed" });
      }

      const paymentId = `voucher_${Date.now()}`;
      await supabase
        .from("transactions")
        .insert([{
          user_id: userId,
          amount: amount,
          type: "deposit",
          provider: "voucher",
          status: "completed",
          payment_id: paymentId,
          reference: voucherCode,
          created_at: new Date().toISOString()
        }]);

      console.log(`✅ Voucher payment completed: R${amount} added to user ${userId}`);
      
      return res.json({ 
        success: true,
        method: 'voucher',
        message: 'Payment successful',
        amount: amount,
        new_balance: newUserBalance
      });
    }

    // Regular PayFast payment
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

    try {
      const { error: insertError } = await supabase
        .from("payments")
        .insert([{
          payment_id: paymentId,
          user_id: userId,
          amount: parseFloat(amount),
          status: "pending",
          payment_method: paymentMethod || 'payfast',
          voucher_code: voucherCode || null,
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
      method: paymentMethod || 'payfast',
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

// ============ WEBHOOK ENDPOINTS ============

app.post("/api/payfast/notify", express.text({ type: "*/*" }), async (req, res) => {
  try {
    console.log("\n" + "=".repeat(60));
    console.log("📨 WEBHOOK RECEIVED - START");
    console.log("=".repeat(60));
    console.log("📝 Raw body:", req.body);

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

      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, balance, username')
        .eq('id', userId)
        .single();

      if (userError) {
        console.error("❌ User not found:", userError);
        return res.status(400).send("User not found");
      }

      console.log(`👤 User found: ${user.username}, Current balance: R${user.balance || 0}`);

      console.log("🔄 Updating user balance...");
      const { error: balanceError } = await supabase
        .rpc("increment_balance", {
          user_id_input: userId,
          amount_input: amount
        });

      if (balanceError) {
        console.error("❌ Balance update error:", balanceError);
        
        console.log("🔄 Trying direct update...");
        const newBalance = (user.balance || 0) + amount;
        const { error: directError } = await supabase
          .from('users')
          .update({ balance: newBalance })
          .eq('id', userId);

        if (directError) {
          console.error("❌ Direct update failed:", directError);
          return res.status(500).send("Failed to update balance");
        } else {
          console.log("✅ Direct update succeeded");
        }
      } else {
        console.log("✅ Balance updated via RPC");
      }

      const { data: updatedUser } = await supabase
        .from('users')
        .select('balance')
        .eq('id', userId)
        .single();

      console.log(`💰 New balance: R${updatedUser?.balance || 0}`);

      console.log("🔄 Handling payments record...");
      
      const { data: existingPayment, error: findError } = await supabase
        .from("payments")
        .select("id, status")
        .eq("payment_id", paymentId)
        .maybeSingle();

      if (findError) {
        console.error("❌ Error checking existing payment:", findError);
      }

      if (existingPayment) {
        console.log("📝 Updating existing payment record");
        const { error: updateError } = await supabase
          .from("payments")
          .update({ 
            status: "completed",
            completed_at: new Date().toISOString(),
            transaction_id: pfPaymentId
          })
          .eq("payment_id", paymentId);

        if (updateError) {
          console.error("❌ Payment update error:", updateError);
        } else {
          console.log("✅ Payment status updated to completed");
        }
      } else {
        console.log("📝 Inserting new payment record");
        const { error: insertError } = await supabase
          .from("payments")
          .insert([{
            payment_id: paymentId,
            user_id: userId,
            amount: amount,
            status: "completed",
            transaction_id: pfPaymentId,
            completed_at: new Date().toISOString(),
            created_at: new Date().toISOString()
          }]);

        if (insertError) {
          console.error("❌ Payment insert error:", insertError);
        } else {
          console.log("✅ Payment record inserted");
        }
      }

      console.log("🔄 Recording transaction...");
      const { error: transactionError } = await supabase
        .from("transactions")
        .insert([{
          user_id: userId,
          amount: amount,
          type: "deposit",
          provider: "payfast",
          status: "completed",
          payment_id: paymentId,
          reference: pfPaymentId,
          created_at: new Date().toISOString()
        }]);

      if (transactionError) {
        console.error("❌ Transaction error:", transactionError);
      } else {
        console.log("✅ Transaction recorded");
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

// ============ DIAGNOSTIC ENDPOINT ============
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
      },
      webauthn: {
        configured: true,
        rpID,
        origin: expectedOrigin,
        rpName
      }
    };

    console.log("📊 Testing Supabase connection...");
    const { error: usersError } = await supabase
      .from('users')
      .select('count', { count: 'exact', head: true });

    results.supabase.connected = !usersError;
    results.supabase.tables.users = usersError ? `❌ ${usersError.message}` : '✅ Connected';

    const { error: paymentsError } = await supabase
      .from('payments')
      .select('count', { count: 'exact', head: true });
    
    results.supabase.tables.payments = paymentsError ? `❌ ${paymentsError.message}` : '✅ Connected';

    const { error: transactionsError } = await supabase
      .from('transactions')
      .select('count', { count: 'exact', head: true });
    
    results.supabase.tables.transactions = transactionsError ? `❌ ${transactionsError.message}` : '✅ Connected';

    const { error: credentialsError } = await supabase
      .from('user_credentials')
      .select('count', { count: 'exact', head: true });
    
    results.supabase.tables.user_credentials = credentialsError ? `❌ ${credentialsError.message}` : '✅ Connected';

    console.log("\n📊 Testing increment_balance RPC function...");
    const testUserId = req.query.userId || '00000000-0000-0000-0000-000000000000';
    const { error: rpcError } = await supabase
      .rpc('increment_balance', {
        user_id_input: testUserId,
        amount_input: 0
      });

    results.supabase.rpc_function = !rpcError ? '✅ Exists' : `❌ ${rpcError.message}`;

    console.log("\n✅ Diagnostic complete");
    console.log("=".repeat(60) + "\n");

    res.json({
      success: true,
      ...results,
      instructions: {
        test_webhook: `/api/payfast/test-notify?userId=YOUR_USER_ID&amount=100`,
        webauthn_register: `POST /api/webauthn/register/begin (no data needed)`,
        webauthn_login: `POST /api/webauthn/login/begin (no data needed)`,
        has_devices: `GET /api/webauthn/has-devices`
      }
    });

  } catch (error) {
    console.error("❌ Diagnostic error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============ SERVE FRONTEND STATIC FILES ============
const distPath = path.join(__dirname, 'dist');

if (isProduction) {
  console.log(`\n📦 Production mode: Serving static files from ${distPath}`);
  
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    
    app.use((req, res, next) => {
      if (req.path.startsWith('/api')) {
        return next();
      }
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
  if (req.path.startsWith('/api')) {
    res.status(404).json({ 
      error: "API endpoint not found", 
      path: req.url
    });
  }
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
  console.log(`🔐 WebAuthn: Configured with RP ID: ${rpID}`);
  console.log('='.repeat(60));
  console.log(`📝 API Endpoints:`);
  console.log(`   🔐 WEBAUTHN (FINGERPRINT):`);
  console.log(`   GET  /api/webauthn/has-devices - Check if any devices exist`);
  console.log(`   POST /api/webauthn/register/begin - Start fingerprint registration (no data needed)`);
  console.log(`   POST /api/webauthn/register/complete - Complete fingerprint registration`);
  console.log(`   POST /api/webauthn/login/begin - Start fingerprint login (no data needed)`);
  console.log(`   POST /api/webauthn/login/complete - Complete fingerprint login`);
  console.log(`   GET  /api/webauthn/devices/:userId - List user's registered devices`);
  console.log(`   DELETE /api/webauthn/devices/:deviceId - Remove a device`);
  console.log('   ' + '-'.repeat(40));
  console.log(`   💰 PAYFAST:`);
  console.log(`   GET  http://localhost:${PORT}/api/health`);
  console.log(`   GET  http://localhost:${PORT}/api/diagnostic`);
  console.log(`   GET  http://localhost:${PORT}/api/payfast/test-notify`);
  console.log(`   POST http://localhost:${PORT}/api/payfast/test-notify`);
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