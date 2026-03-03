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

// Load environment variables
const isProduction = process.env.NODE_ENV === 'production';

if (!isProduction) {
  const envPath = path.join(__dirname, '.env');
  console.log(' Looking for .env at:', envPath);
  if (fs.existsSync(envPath)) {
    console.log(' Found .env file');
    dotenv.config({ path: envPath });
  } else {
    console.log(' No .env file found, using environment variables');
  }
} else {
  console.log(' Production mode: Using environment variables from Render dashboard');
}

// Display loaded variables
console.log(' Environment variables loaded:');
const envVars = [
  'VITE_SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'PAYFAST_MERCHANT_ID',
  'PAYFAST_MERCHANT_KEY', 'PAYFAST_PASSPHRASE', 'PAYFAST_BASE_URL',
  'APP_BASE_URL', 'VITE_BACKEND_URL', 'CONTACT_EMAIL', 'RP_ID', 'RP_NAME', 'ORIGIN'
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

// Verify required environment variables
const requiredEnvVars = [
  'VITE_SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'PAYFAST_MERCHANT_ID',
  'PAYFAST_MERCHANT_KEY', 'PAYFAST_PASSPHRASE', 'PAYFAST_BASE_URL', 'APP_BASE_URL'
];

const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error(' Missing required environment variables:');
  missingEnvVars.forEach(varName => console.error(`   - ${varName}`));
  
  if (isProduction) {
    console.error('\n⚠️ Starting server anyway - but some features may not work!');
    console.error('Please add these variables in your Render dashboard');
  } else {
    console.error('\nPlease create a .env file with these variables');
    process.exit(1);
  }
}

console.log(' All required environment variables found');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// CORS Configuration - Added localhost:5174
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174", // Added for Vite
  "http://localhost:3000",
  "http://localhost:4242",
  process.env.APP_BASE_URL,
  /\.ngrok-free\.app$/,
  /\.onrender\.com$/
].filter(Boolean);

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    const allowed = allowedOrigins.some(allowed => 
      typeof allowed === 'string' ? allowed === origin : allowed.test(origin)
    );
    if (allowed) {
      callback(null, true);
    } else {
      console.log(' Blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "ngrok-skip-browser-warning"],
  credentials: true,
  optionsSuccessStatus: 200
}));

// Initialize Supabase
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

console.log(' Supabase client initialized');

// ============ WEBAUTHN CONFIGURATION ============
const challenges = new Map();

const rpID = process.env.RP_ID || (isProduction ? 'savingwork.onrender.com' : 'localhost');
const expectedOrigin = process.env.ORIGIN || (isProduction ? 'https://savingwork.onrender.com' : 'http://localhost:5173');
const rpName = process.env.RP_NAME || 'Face Recognition App';

console.log(`🔐 WebAuthn configured with RP ID: ${rpID}, Origin: ${expectedOrigin}`);

// Helper function to convert standard base64 to base64url
function toBase64url(base64String) {
  return base64String
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// Helper function to convert base64url to standard base64
function fromBase64url(base64urlString) {
  let base64 = base64urlString
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  
  // Add padding back
  const padding = 4 - (base64.length % 4);
  if (padding < 4) {
    base64 += '='.repeat(padding);
  }
  return base64;
}

// ============ WEBAUTHN ENDPOINTS ============

// Check if any devices exist
app.get('/api/webauthn/has-devices', async (req, res) => {
  try {
    const { count, error } = await supabase
      .from('user_credentials')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error(' Failed to check devices:', error);
      return res.status(500).json({ error: 'Failed to check devices' });
    }

    res.json({ hasDevices: count > 0 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Registration Begin
app.post('/api/webauthn/register/begin', async (req, res) => {
  try {
    const tempUserId = `temp_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    const tempUsername = `user_${Date.now().toString().slice(-6)}`;

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: Buffer.from(tempUserId, 'utf8'),
      userName: tempUsername,
      userDisplayName: 'User',
      attestationType: 'none',
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'preferred',
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

    res.json({ ...options, challengeId });
  } catch (error) {
    console.error(' Registration begin error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Registration Complete - Fixed to store as base64url
app.post('/api/webauthn/register/complete', async (req, res) => {
  try {
    const { credential, challengeId } = req.body;
    
    if (!credential || !challengeId) {
      return res.status(400).json({ error: 'Missing credential or challengeId' });
    }

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

    if (!verification.verified || !verification.registrationInfo) {
      return res.status(400).json({ verified: false });
    }

    const { registrationInfo } = verification;

    // Create user
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
      console.error(' Failed to create user:', userError);
      return res.status(500).json({ error: 'Failed to create user' });
    }

    // Convert credential ID to base64url for storage
    const credentialIdBase64 = Buffer.from(registrationInfo.credentialID).toString('base64');
    const credentialIdBase64url = toBase64url(credentialIdBase64);

    // Store credential in base64url format
    const { error: dbError } = await supabase
      .from('user_credentials')
      .insert({
        user_id: newUser.id,
        credential_id: credentialIdBase64url, // Store as base64url
        public_key: registrationInfo.credentialPublicKey.toString('base64'),
        counter: registrationInfo.counter || 0,
        device_type: registrationInfo.credentialDeviceType || 'unknown',
        backed_up: registrationInfo.credentialBackedUp || false,
        transports: credential.response?.transports || ['internal'],
        created_at: new Date().toISOString()
      });

    if (dbError) {
      console.error(' Failed to store credential:', dbError);
      return res.status(500).json({ error: 'Failed to store credential' });
    }

    challenges.delete(challengeId);
    
    res.json({ 
      verified: true,
      user: newUser
    });
  } catch (error) {
    console.error(' Registration complete error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Login Begin - FIXED for base64url
app.post('/api/webauthn/login/begin', async (req, res) => {
  try {
    const { userId } = req.body || {};
    
    let query = supabase.from('user_credentials').select('credential_id, transports, user_id');
    if (userId) {
      query = query.eq('user_id', userId);
    }
    
    const { data: credentials, error: dbError } = await query;

    if (dbError) {
      console.error(' Failed to fetch credentials:', dbError);
      return res.status(500).json({ error: 'Failed to fetch credentials' });
    }

    if (!credentials || credentials.length === 0) {
      return res.status(404).json({ error: 'No registered devices found' });
    }

    // Format credentials - ensure they are in base64url format
    const allowCredentials = credentials.map(cred => {
      // If the stored ID contains / or +, it's standard base64, convert to base64url
      let credentialId = cred.credential_id;
      
      // Ensure it's in base64url format (no padding, - instead of +, _ instead of /)
      credentialId = credentialId
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
      
      return {
        id: credentialId,
        type: 'public-key',
        transports: cred.transports || ['internal', 'hybrid'],
      };
    });

    console.log(`✅ Formatted ${allowCredentials.length} credentials in base64url`);

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials,
      userVerification: 'required',
      timeout: 60000,
    });

    const challengeId = crypto.randomBytes(16).toString('hex');
    challenges.set(challengeId, {
      challenge: options.challenge,
      userId: userId || null,
      timestamp: Date.now()
    });

    res.json({ ...options, challengeId });
  } catch (error) {
    console.error(' Login begin error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Login Complete - FIXED with proper base64url handling
app.post('/api/webauthn/login/complete', async (req, res) => {
  try {
    const { credential, challengeId } = req.body;
    
    if (!credential || !challengeId) {
      return res.status(400).json({ error: 'Missing data' });
    }

    const storedData = challenges.get(challengeId);
    if (!storedData) {
      return res.status(400).json({ error: 'No session found' });
    }

    // The credential.id from client is in base64url format
    const clientCredentialId = credential.id;
    
    console.log('Looking for credential:', clientCredentialId.substring(0, 30) + '...');

    // Try multiple strategies to find the credential
    let storedCredential = null;
    
    // Strategy 1: Direct match with stored base64url
    const { data: exactMatch } = await supabase
      .from('user_credentials')
      .select('*, users(*)')
      .eq('credential_id', clientCredentialId)
      .maybeSingle();
    
    if (exactMatch) {
      storedCredential = exactMatch;
      console.log('✅ Credential found with exact match (base64url)');
    } else {
      // Strategy 2: Try converting client ID to standard base64 (some older records might be stored this way)
      const standardBase64 = fromBase64url(clientCredentialId);
      
      const { data: convertedMatch } = await supabase
        .from('user_credentials')
        .select('*, users(*)')
        .eq('credential_id', standardBase64)
        .maybeSingle();
      
      if (convertedMatch) {
        storedCredential = convertedMatch;
        console.log('✅ Credential found after conversion to standard base64');
      }
    }

    if (!storedCredential) {
      console.error('❌ Credential not found');
      return res.status(404).json({ error: 'Credential not found' });
    }

    console.log('✅ Credential found for user:', storedCredential.users.id);

    // Convert public key
    let publicKeyBuffer;
    try {
      publicKeyBuffer = Buffer.from(storedCredential.public_key, 'base64');
    } catch (e) {
      console.error('❌ Failed to convert public key:', e);
      return res.status(500).json({ error: 'Failed to process public key' });
    }

    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge: storedData.challenge,
      expectedOrigin,
      expectedRPID: rpID,
      credential: {
        id: storedCredential.credential_id,
        publicKey: publicKeyBuffer,
        counter: storedCredential.counter || 0,
        transports: storedCredential.transports || ['internal'],
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
        .eq('id', storedCredential.id);

      challenges.delete(challengeId);
      
      res.json({ 
        verified: true,
        user: storedCredential.users
      });
    } else {
      res.status(400).json({ verified: false });
    }
  } catch (error) {
    console.error(' Login complete error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get user devices
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

// Remove device
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

// Debug endpoints
app.get('/api/webauthn/debug-credentials', async (req, res) => {
  try {
    const { data: credentials, error } = await supabase
      .from('user_credentials')
      .select('credential_id, transports, user_id, device_type, counter');

    if (error) throw error;

    const formatted = credentials.map(cred => ({
      credential_id_preview: cred.credential_id.substring(0, 30) + '...',
      credential_id_length: cred.credential_id.length,
      has_padding: cred.credential_id.includes('='),
      has_slash: cred.credential_id.includes('/'),
      has_plus: cred.credential_id.includes('+'),
      is_base64url: !cred.credential_id.includes('/') && !cred.credential_id.includes('+'),
      transports: cred.transports,
      user_id: cred.user_id,
      device_type: cred.device_type,
      counter: cred.counter
    }));

    res.json({ count: credentials.length, credentials: formatted });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/debug/challenges', (req, res) => {
  res.json({
    count: challenges.size,
    keys: Array.from(challenges.keys()),
    serverTime: Date.now()
  });
});

app.get('/api/webauthn/diagnose', async (req, res) => {
  try {
    const { count } = await supabase
      .from('user_credentials')
      .select('*', { count: 'exact', head: true });

    const { data: sample } = await supabase
      .from('user_credentials')
      .select('credential_id, user_id')
      .limit(1);

    res.json({
      server: { time: new Date().toISOString(), rpID, origin: expectedOrigin, isProduction },
      database: {
        credentials_count: count || 0,
        sample_credential: sample?.[0] ? {
          id_preview: sample[0].credential_id.substring(0, 30) + '...',
          length: sample[0].credential_id.length,
          has_padding: sample[0].credential_id.includes('='),
          has_slash: sample[0].credential_id.includes('/'),
          has_plus: sample[0].credential_id.includes('+')
        } : null
      },
      challenges: { active_count: challenges.size }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check
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

// ============ PAYFAST ============
function generatePayFastSignature(params, passphrase) {
  const orderedParams = {};
  Object.keys(params).forEach(key => {
    if (params[key]) orderedParams[key] = params[key];
  });
  
  const paramPairs = [];
  for (const key of Object.keys(orderedParams)) {
    const value = String(orderedParams[key]).trim();
    const encodedValue = encodeURIComponent(value).replace(/%20/g, '+');
    paramPairs.push(`${key}=${encodedValue}`);
  }
  
  const paramString = paramPairs.join('&');
  const stringToHash = paramString + '&passphrase=' + String(passphrase).trim();
  return crypto.createHash('md5').update(stringToHash).digest('hex');
}

app.post("/api/payfast/create-payment", async (req, res) => {
  try {
    const { amount, userId, paymentMethod, voucherCode } = req.body;

    if (!amount || !userId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Voucher payment
    if (paymentMethod === 'voucher') {
      if (!voucherCode) return res.status(400).json({ error: "Voucher code required" });

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
        new_balance: (user.balance || 0) + amount
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

    await supabase.from("payments").insert([{
      payment_id: paymentId,
      user_id: userId,
      amount: parseFloat(amount),
      status: "pending",
      created_at: new Date().toISOString()
    }]);

    res.json({ success: true, url: payfastUrl, payment_id: paymentId });
  } catch (error) {
    console.error(" Payment error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/payfast/notify", express.text({ type: "*/*" }), async (req, res) => {
  try {
    const params = Object.fromEntries(
      req.body.split("&").map(pair => {
        const [key, value] = pair.split("=");
        return [key, decodeURIComponent(value || "")];
      })
    );

    const receivedSignature = params.signature;
    delete params.signature;
    
    const expectedSignature = generatePayFastSignature(params, process.env.PAYFAST_PASSPHRASE);

    if (receivedSignature !== expectedSignature) {
      return res.status(400).send("Invalid signature");
    }

    if (params.payment_status === "COMPLETE") {
      const userId = params.custom_str1;
      const amount = parseFloat(params.amount_gross);
      const paymentId = params.m_payment_id;

      const { data: user } = await supabase
        .from('users')
        .select('balance')
        .eq('id', userId)
        .single();

      await supabase
        .from('users')
        .update({ balance: (user.balance || 0) + amount })
        .eq('id', userId);

      await supabase
        .from("payments")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("payment_id", paymentId);

      await supabase.from("transactions").insert([{
        user_id: userId,
        amount: amount,
        type: "deposit",
        provider: "payfast",
        status: "completed",
        payment_id: paymentId,
        created_at: new Date().toISOString()
      }]);
    }

    res.status(200).send("OK");
  } catch (error) {
    console.error(" Webhook error:", error);
    res.status(500).send("Error");
  }
});

// ============ SERVE FRONTEND ============
const distPath = path.join(__dirname, 'dist');

if (isProduction) {
  console.log(`\n📦 Serving static files from ${distPath}`);
  
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    
    app.use((req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(distPath, 'index.html'));
    });
    
    console.log(' Static file serving enabled');
  } else {
    console.error(' dist folder not found at:', distPath);
  }
}

// Error handling
app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    res.status(404).json({ error: "API endpoint not found" });
  }
});

app.use((err, req, res, next) => {
  console.error(" Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// Start server
app.listen(PORT, () => {
  console.log('\n' + '='.repeat(60));
  console.log(`🚀 SERVER STARTED ON PORT ${PORT}`);
  console.log('='.repeat(60));
  console.log(`🔐 WebAuthn RP ID: ${rpID}`);
  console.log(`🌐 Origin: ${expectedOrigin}`);
  console.log('='.repeat(60) + '\n');
});