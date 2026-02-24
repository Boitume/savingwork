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
  console.log('📁 Production mode: Using environment variables');
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
  
  if (isProduction) {
    console.error('\nPlease add these environment variables in your Render dashboard');
    process.exit(1);
  } else {
    console.error('\nPlease create a .env file with these variables');
    process.exit(1);
  }
}

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

// ✅ REGISTRATION BEGIN - FOR NEW USERS
app.post('/api/webauthn/register/begin', async (req, res) => {
  try {
    console.log('🔐 Starting WebAuthn registration for new user');

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

// ✅ COMPLETE REGISTRATION
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

// ✅ LOGIN BEGIN - PURE BIOMETRIC
app.post('/api/webauthn/login/begin', async (req, res) => {
  try {
    console.log('🔐 Starting WebAuthn authentication (pure biometric)');

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

// ✅ LOGIN COMPLETE
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
      appBaseUrl: process.env.APP_BASE_URL,
      webauthn: {
        rpID,
        origin: expectedOrigin,
        configured: true
      }
    }
  });
});

// ✅ Diagnostic endpoint
app.get("/api/diagnostic", async (req, res) => {
  try {
    console.log("\n🔧 DIAGNOSTIC CHECK");
    
    const results = {
      server: {
        time: new Date().toISOString(),
        node_version: process.version,
        environment: isProduction ? 'production' : 'development'
      },
      supabase: {
        connected: false,
        tables: {}
      },
      webauthn: {
        configured: true,
        rpID,
        origin: expectedOrigin,
        rpName
      }
    };

    // Test Supabase connection
    const { error: usersError } = await supabase
      .from('users')
      .select('count', { count: 'exact', head: true });

    results.supabase.connected = !usersError;
    results.supabase.tables.users = usersError ? `❌ ${usersError.message}` : '✅ Connected';

    res.json({
      success: true,
      ...results,
      instructions: {
        webauthn_register: `POST /api/webauthn/register/begin`,
        webauthn_login: `POST /api/webauthn/login/begin`
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
  console.log(`🌍 Mode: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
  console.log(`🔐 WebAuthn: Configured with RP ID: ${rpID}`);
  console.log('='.repeat(60));
  console.log(`📝 API Endpoints:`);
  console.log(`   🔐 WEBAUTHN:`);
  console.log(`   GET  /api/webauthn/has-devices`);
  console.log(`   POST /api/webauthn/register/begin`);
  console.log(`   POST /api/webauthn/register/complete`);
  console.log(`   POST /api/webauthn/login/begin`);
  console.log(`   POST /api/webauthn/login/complete`);
  console.log(`   GET  /api/webauthn/devices/:userId`);
  console.log(`   DELETE /api/webauthn/devices/:deviceId`);
  console.log('='.repeat(60) + '\n');
});