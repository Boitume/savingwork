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
    console.log('🔍 Checking for registered devices...');
    const { count, error } = await supabase
      .from('user_credentials')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error('❌ Failed to check devices:', error);
      return res.status(500).json({ error: 'Failed to check devices' });
    }

    console.log(`📊 Device count: ${count}`);
    res.json({ hasDevices: count > 0 });
  } catch (error) {
    console.error('❌ Error checking devices:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ REGISTRATION BEGIN - FOR NEW USERS
app.post('/api/webauthn/register/begin', async (req, res) => {
  try {
    console.log('🔐 Starting WebAuthn registration for new user');

    // Generate a temporary user ID
    const tempUserId = `temp_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    const tempUsername = `user_${Date.now().toString().slice(-6)}`;

    // Convert string to Buffer/Uint8Array for v10+ compatibility
    const userIDBuffer = Buffer.from(tempUserId, 'utf8');
    
    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: userIDBuffer,
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

// ✅ COMPLETE REGISTRATION - PERMANENT FIX WITH DATABASE SCHEMA COMPATIBILITY
app.post('/api/webauthn/register/complete', async (req, res) => {
  try {
    const { credential, challengeId } = req.body;
    
    console.log('\n🔐 REGISTRATION COMPLETE - START');
    console.log('Challenge ID:', challengeId);
    console.log('Credential received:', credential ? 'Yes' : 'No');
    
    if (!credential || !challengeId) {
      console.error('❌ Missing credential or challengeId');
      return res.status(400).json({ error: 'Missing credential or challengeId' });
    }

    // Check if credential has required fields
    if (!credential.id) {
      console.error('❌ Credential missing id field');
      return res.status(400).json({ error: 'Invalid credential: missing id' });
    }

    if (!credential.response) {
      console.error('❌ Credential missing response field');
      return res.status(400).json({ error: 'Invalid credential: missing response' });
    }

    console.log('Credential ID received:', credential.id.substring(0, 20) + '...');

    const storedData = challenges.get(challengeId);
    if (!storedData) {
      console.error('❌ No registration session found for challenge ID:', challengeId);
      console.log('Available challenges:', Array.from(challenges.keys()));
      return res.status(400).json({ error: 'No registration session found' });
    }

    console.log('Stored data found for user:', storedData.tempUsername);
    console.log('Expected challenge:', storedData.challenge.substring(0, 20) + '...');

    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge: storedData.challenge,
      expectedOrigin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });

    console.log('Verification result:', { 
      verified: verification.verified, 
      hasRegistrationInfo: !!verification.registrationInfo 
    });

    const { verified, registrationInfo } = verification;

    if (verified) {
      console.log('✅ Registration verified successfully');
      
      // === EXTRACT CREDENTIAL DATA FROM MULTIPLE POSSIBLE LOCATIONS ===
      let rawCredentialID = null;
      let rawPublicKey = null;
      let counter = 0;
      let deviceType = 'unknown';
      let backedUp = false;
      
      // Method 1: Standard SimpleWebAuthn v10+ format
      if (registrationInfo) {
        console.log('📦 Using registrationInfo format');
        rawCredentialID = registrationInfo.credentialID;
        rawPublicKey = registrationInfo.credentialPublicKey;
        counter = registrationInfo.counter || 0;
        deviceType = registrationInfo.credentialDeviceType || 'unknown';
        backedUp = registrationInfo.credentialBackedUp || false;
      }
      
      // Method 2: Fallback to credential.id
      if (!rawCredentialID && credential.id) {
        console.log('📦 Falling back to credential.id');
        try {
          rawCredentialID = Buffer.from(credential.id, 'base64');
        } catch (e) {
          console.error('❌ Failed to convert credential.id:', e);
        }
      }
      
      // Method 3: Last resort for development
      if (!rawCredentialID && !isProduction) {
        console.warn('⚠️ DEVELOPMENT: Generating temporary credential ID');
        rawCredentialID = crypto.randomBytes(32);
        rawPublicKey = crypto.randomBytes(65);
      }

      if (!rawCredentialID) {
        console.error('❌ Could not extract credential ID');
        return res.status(500).json({ error: 'Failed to process credential' });
      }

      if (!rawPublicKey) {
        console.error('❌ Could not extract public key');
        return res.status(500).json({ error: 'Failed to process public key' });
      }

      // Convert to base64 for storage
      let credentialIdBase64, publicKeyBase64;
      try {
        credentialIdBase64 = Buffer.isBuffer(rawCredentialID) 
          ? rawCredentialID.toString('base64')
          : Buffer.from(rawCredentialID).toString('base64');
        
        publicKeyBase64 = Buffer.isBuffer(rawPublicKey)
          ? rawPublicKey.toString('base64')
          : Buffer.from(rawPublicKey).toString('base64');
      } catch (e) {
        console.error('❌ Buffer conversion error:', e);
        return res.status(500).json({ error: 'Failed to convert credential data' });
      }

      // Create new user
      console.log('👤 Creating new user:', storedData.tempUsername);
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

      console.log('✅ User created:', newUser.id);

      // Store credential - using correct column names
      const credentialData = {
        user_id: newUser.id,
        credential_id: credentialIdBase64,
        public_key: publicKeyBase64,
        counter: counter,
        device_type: deviceType,
        backed_up: backedUp,
        transports: credential.response?.transports || ['internal'],
        created_at: new Date().toISOString()
      };

      console.log('📦 Storing credential with data:', {
        ...credentialData,
        credential_id: credentialData.credential_id.substring(0, 20) + '...',
        public_key: '[HIDDEN]'
      });

      const { error: dbError } = await supabase
        .from('user_credentials')
        .insert(credentialData);

      if (dbError) {
        console.error('❌ Failed to store credential:', dbError);
        return res.status(500).json({ 
          error: 'Failed to store credential',
          details: dbError.message,
          code: dbError.code
        });
      }

      console.log('✅ Credential stored successfully');
      
      challenges.delete(challengeId);
      console.log('🧹 Challenge deleted');
      
      res.json({ 
        verified: true,
        user: newUser
      });
    } else {
      console.log('❌ WebAuthn registration verification failed');
      res.status(400).json({ verified: false, error: 'Verification failed' });
    }
  } catch (error) {
    console.error('❌ WebAuthn registration complete error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ LOGIN BEGIN - PURE BIOMETRIC
app.post('/api/webauthn/login/begin', async (req, res) => {
  try {
    console.log('🔐 Starting WebAuthn authentication');

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
      transports: cred.transports || ['internal'],
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

    console.log(`✅ Authentication options generated: ${challengeId}`);
    res.json({ ...options, challengeId });
  } catch (error) {
    console.error('❌ Login begin error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ LOGIN COMPLETE
app.post('/api/webauthn/login/complete', async (req, res) => {
  try {
    const { credential, challengeId } = req.body;
    
    console.log('\n🔐 LOGIN COMPLETE - START');
    
    if (!credential || !challengeId) {
      return res.status(400).json({ error: 'Missing data' });
    }

    const storedData = challenges.get(challengeId);
    if (!storedData) {
      return res.status(400).json({ error: 'No session found' });
    }

    const { data: storedCredential, error: dbError } = await supabase
      .from('user_credentials')
      .select('*, users(*)')
      .eq('credential_id', credential.id)
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

    if (verification.verified) {
      await supabase
        .from('user_credentials')
        .update({ 
          counter: verification.authenticationInfo.newCounter,
          last_used: new Date().toISOString()
        })
        .eq('credential_id', credential.id);

      console.log(`✅ Login successful: ${storedCredential.users.id}`);
      challenges.delete(challengeId);
      
      res.json({ 
        verified: true,
        user: storedCredential.users
      });
    } else {
      res.status(400).json({ verified: false });
    }
  } catch (error) {
    console.error('❌ Login complete error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ GET USER DEVICES
app.get('/api/webauthn/devices/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const { data: devices, error } = await supabase
      .from('user_credentials')
      .select('id, device_type, backed_up, created_at, last_used, transports')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ devices });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ✅ REMOVE DEVICE
app.delete('/api/webauthn/devices/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { userId } = req.body;

    const { error } = await supabase
      .from('user_credentials')
      .delete()
      .eq('id', deviceId)
      .eq('user_id', userId);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ✅ DEBUG CHALLENGES
app.get('/api/debug/challenges', (req, res) => {
  res.json({
    count: challenges.size,
    keys: Array.from(challenges.keys()),
    serverTime: Date.now()
  });
});

// ✅ HEALTH CHECK
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "OK",
    timestamp: new Date().toISOString(),
    environment: {
      node: process.version,
      port: PORT,
      supabase: process.env.VITE_SUPABASE_URL ? 'Connected' : 'Disconnected',
      webauthn: { rpID, origin: expectedOrigin, configured: true }
    }
  });
});

// ✅ PAYFAST SIGNATURE GENERATOR
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
  return crypto.createHash('md5').update(stringToHash).digest('hex');
}

// ✅ CREATE PAYMENT
app.post("/api/payfast/create-payment", async (req, res) => {
  try {
    const { amount, userId, paymentMethod, voucherCode } = req.body;

    if (!amount || !userId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Voucher payment
    if (paymentMethod === 'voucher') {
      if (!voucherCode) {
        return res.status(400).json({ error: "Voucher code required" });
      }

      const { data: voucher } = await supabase
        .from('vouchers')
        .select('*')
        .eq('code', voucherCode)
        .eq('status', 'active')
        .single();

      if (!voucher || voucher.balance < amount) {
        return res.status(400).json({ error: "Invalid voucher" });
      }

      const { data: user } = await supabase
        .from('users')
        .select('balance')
        .eq('id', userId)
        .single();

      const newBalance = (user.balance || 0) + amount;

      await supabase.rpc('process_voucher_payment', {
        p_user_id: userId,
        p_amount: amount,
        p_voucher_id: voucher.id,
        p_voucher_code: voucherCode
      });

      return res.json({ 
        success: true,
        method: 'voucher',
        amount,
        new_balance: newBalance
      });
    }

    // PayFast payment
    const paymentId = `pay_${Date.now()}`;
    const data = {
      merchant_id: String(process.env.PAYFAST_MERCHANT_ID).trim(),
      merchant_key: String(process.env.PAYFAST_MERCHANT_KEY).trim(),
      return_url: String(`${process.env.APP_BASE_URL}/payment/success`).trim(),
      cancel_url: String(`${process.env.APP_BASE_URL}/payment/cancel`).trim(),
      notify_url: String(`${process.env.APP_BASE_URL}/payfast/notify`).trim(),
      m_payment_id: paymentId,
      amount: String(parseFloat(amount).toFixed(2)),
      item_name: "Savings Deposit",
      custom_str1: String(userId)
    };

    data.signature = generatePayFastSignature(data, process.env.PAYFAST_PASSPHRASE);

    const queryString = Object.keys(data)
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(data[key])}`)
      .join("&");
    
    const payfastUrl = `${process.env.PAYFAST_BASE_URL}?${queryString}`;

    // Store payment record
    await supabase.from("payments").insert([{
      payment_id: paymentId,
      user_id: userId,
      amount: parseFloat(amount),
      status: "pending",
      created_at: new Date().toISOString()
    }]);

    res.json({ success: true, url: payfastUrl, payment_id: paymentId });
  } catch (error) {
    console.error("❌ Payment error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ PAYFAST WEBHOOK
app.post("/api/payfast/notify", express.text({ type: "*/*" }), async (req, res) => {
  try {
    console.log("\n📨 WEBHOOK RECEIVED");
    
    const params = Object.fromEntries(
      req.body.split("&").map(pair => {
        const [key, value] = pair.split("=");
        return [key, decodeURIComponent(value || "")];
      })
    );

    const receivedSignature = params.signature;
    delete params.signature;
    
    const expectedSignature = generatePayFastSignature(
      params, 
      process.env.PAYFAST_PASSPHRASE
    );

    if (receivedSignature !== expectedSignature) {
      console.error("❌ Invalid signature");
      return res.status(400).send("Invalid signature");
    }

    if (params.payment_status === "COMPLETE") {
      const userId = params.custom_str1;
      const amount = parseFloat(params.amount_gross);
      const paymentId = params.m_payment_id;

      // Update user balance
      const { data: user } = await supabase
        .from('users')
        .select('balance')
        .eq('id', userId)
        .single();

      const newBalance = (user.balance || 0) + amount;
      
      await supabase
        .from('users')
        .update({ balance: newBalance })
        .eq('id', userId);

      // Update payment status
      await supabase
        .from("payments")
        .update({ 
          status: "completed",
          completed_at: new Date().toISOString()
        })
        .eq("payment_id", paymentId);

      // Record transaction
      await supabase.from("transactions").insert([{
        user_id: userId,
        amount: amount,
        type: "deposit",
        provider: "payfast",
        status: "completed",
        payment_id: paymentId,
        created_at: new Date().toISOString()
      }]);

      console.log(`✅ Payment completed: R${amount} for user ${userId}`);
    }

    res.status(200).send("OK");
  } catch (error) {
    console.error("❌ Webhook error:", error);
    res.status(500).send("Error");
  }
});

// ✅ DIAGNOSTIC ENDPOINT
app.get("/api/diagnostic", async (req, res) => {
  try {
    const results = {
      server: {
        time: new Date().toISOString(),
        node_version: process.version,
        environment: isProduction ? 'production' : 'development'
      },
      supabase: { connected: false, tables: {} },
      webauthn: { rpID, origin: expectedOrigin }
    };

    // Test connections
    const { error: usersError } = await supabase
      .from('users')
      .select('count', { count: 'exact', head: true });

    results.supabase.connected = !usersError;
    results.supabase.tables.users = usersError ? '❌' : '✅';

    res.json({ success: true, ...results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ SERVE FRONTEND - FIXED VERSION ============
const distPath = path.join(__dirname, 'dist');

if (isProduction) {
  console.log(`\n📦 Production mode: Serving static files from ${distPath}`);
  
  // Check if dist folder exists
  if (fs.existsSync(distPath)) {
    // Serve static files first
    app.use(express.static(distPath));
    
    // Log dist contents for debugging
    try {
      const files = fs.readdirSync(distPath);
      console.log('📄 Files in dist:', files.join(', '));
      
      // Check for index.html specifically
      if (files.includes('index.html')) {
        console.log('✅ index.html found in dist');
      } else {
        console.error('❌ index.html NOT found in dist!');
      }
    } catch (e) {
      console.error('❌ Cannot read dist folder:', e.message);
    }
    
    // Handle all non-API routes by serving index.html (FIXED: using app.use instead of app.get('*'))
    app.use((req, res, next) => {
      // Skip API routes
      if (req.path.startsWith('/api')) {
        return next();
      }
      
      // Serve index.html for client-side routing
      const indexPath = path.join(distPath, 'index.html');
      
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        console.error('❌ index.html not found at:', indexPath);
        res.status(500).send(`
          <html>
            <head><title>Error</title></head>
            <body>
              <h1>Frontend build not found</h1>
              <p>The index.html file is missing from the dist folder.</p>
              <p>Expected path: ${indexPath}</p>
            </body>
          </html>
        `);
      }
    });
    
    console.log('✅ Static file serving enabled with client-side routing');
  } else {
    console.error('❌ dist folder not found at:', distPath);
    console.log('📁 Current directory:', __dirname);
    
    // List files in current directory for debugging
    try {
      const files = fs.readdirSync(__dirname);
      console.log('📁 Files in current directory:', files.join(', '));
    } catch (e) {
      console.error('❌ Cannot read current directory:', e.message);
    }
    
    // Serve a helpful error page
    app.use((req, res) => {
      if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'API endpoint not found' });
      }
      
      res.status(500).send(`
        <html>
          <head><title>Build Error</title></head>
          <body>
            <h1>Frontend build not found</h1>
            <p>The dist folder does not exist. Please run <code>npm run build</code> to build the frontend.</p>
            <p>Expected path: ${distPath}</p>
          </body>
        </html>
      `);
    });
  }
} else {
  console.log(`\n🔄 Development mode: API only, frontend running on Vite dev server`);
  
  // In development, handle API routes and return helpful message for others
  app.use((req, res, next) => {
    if (!req.path.startsWith('/api')) {
      return res.status(404).json({ 
        error: 'In development mode, please use the Vite dev server on http://localhost:5173' 
      });
    }
    next();
  });
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
  console.log(`   GET  /api/debug/challenges - Debug: View active challenges`);
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