import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';

export default function Test() {
  const [status, setStatus] = useState('Testing connection...');

  useEffect(() => {
    testConnection();
  }, []);

  const testConnection = async () => {
    try {
      // Test 1: Check Supabase connection
      setStatus('Testing Supabase connection...');
      const { data, error } = await supabase.from('users').select('count').limit(1);
      
      if (error) {
        setStatus(`❌ Supabase error: ${error.message}`);
        console.error(error);
        return;
      }

      setStatus('✅ Supabase connected!');

      // Test 2: Check auth session
      setStatus('Checking auth session...');
      const { data: sessionData } = await supabase.auth.getSession();
      
      if (sessionData.session) {
        setStatus(`✅ Logged in as: ${sessionData.session.user.email}`);
      } else {
        setStatus('ℹ️ Not logged in');
      }

    } catch (err) {
      setStatus(`❌ Error: ${err.message}`);
    }
  };

  const handleGoogleLogin = async () => {
    setStatus('Redirecting to Google...');
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
        <h1 className="text-2xl font-bold mb-4">Test Page</h1>
        <div className="mb-4 p-4 bg-gray-50 rounded-lg">
          <p className="font-mono text-sm">{status}</p>
        </div>
        <button
          onClick={handleGoogleLogin}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700"
        >
          Test Google Login
        </button>
      </div>
    </div>
  );
}