import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
import { supabase } from './supabase';

export async function registerFingerprint(userId: string, username: string) {
  try {
    // 1. Get registration options from your backend
    const response = await fetch('/api/webauthn/register/begin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, username })
    });
    
    const options = await response.json();
    
    // 2. Start browser registration (this triggers fingerprint scan)
    const attResp = await startRegistration({ optionsJSON: options });
    
    // 3. Send verification to backend
    const verificationResp = await fetch('/api/webauthn/register/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(attResp)
    });
    
    const verificationJSON = await verificationResp.json();
    
    if (verificationJSON.verified) {
      console.log('✅ Fingerprint registered successfully');
      return true;
    }
  } catch (error) {
    console.error('❌ Fingerprint registration failed:', error);
    return false;
  }
}

export async function authenticateWithFingerprint() {
  try {
    // 1. Get authentication challenge
    const response = await fetch('/api/webauthn/login/begin');
    const options = await response.json();
    
    // 2. Start authentication (fingerprint scan)
    const authResp = await startAuthentication({ optionsJSON: options });
    
    // 3. Verify with backend
    const verificationResp = await fetch('/api/webauthn/login/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(authResp)
    });
    
    const verificationJSON = await verificationResp.json();
    
    if (verificationJSON.verified) {
      // Get user data after successful auth
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    }
  } catch (error) {
    console.error('❌ Fingerprint authentication failed:', error);
    return null;
  }
}