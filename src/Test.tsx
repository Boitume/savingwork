import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';

export default function Test() {
  const [status, setStatus] = useState('Testing connection...');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Handle the OAuth redirect
    handleAuthRedirect();
  }, []);

  const handleAuthRedirect = async () => {
    try {
      setStatus('Processing authentication...');
      
      // Get the session after redirect
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        setStatus(`❌ Auth error: ${error.message}`);
        console.error(error);
        setLoading(false);
        return;
      }

      if (session) {
        setStatus(`✅ Logged in as: ${session.user.email}`);
        setUser(session.user);
        
        // Check if user exists in our database
        await checkOrCreateUser(session.user);
      } else {
        setStatus('ℹ️ Not logged in');
        setLoading(false);
      }
    } catch (err) {
      setStatus(`❌ Error: ${err.message}`);
      setLoading(false);
    }
  };

  const checkOrCreateUser = async (authUser: any) => {
    try {
      setStatus('Checking user in database...');
      
      // Check if user exists
      const { data: existingUser, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      if (fetchError) {
        setStatus(`❌ Database error: ${fetchError.message}`);
        console.error(fetchError);
        setLoading(false);
        return;
      }

      if (existingUser) {
        setStatus(`✅ User found in database: ${existingUser.username}`);
        console.log('Existing user:', existingUser);
        setLoading(false);
      } else {
        setStatus('🔄 Creating new user in database...');
        
        // Create new user WITHOUT face_descriptor (it will be NULL)
        const newUser = {
          id: authUser.id,
          username: authUser.email?.split('@')[0] || `user_${Date.now()}`,
          email: authUser.email,
          first_name: authUser.user_metadata?.full_name?.split(' ')[0] || '',
          last_name: authUser.user_metadata?.full_name?.split(' ').slice(1).join(' ') || '',
          avatar_url: authUser.user_metadata?.avatar_url,
          provider: 'google',
          balance: 0
          // ❌ No face_descriptor field - it will be NULL
        };

        console.log('Attempting to insert:', newUser);

        const { data, error: insertError } = await supabase
          .from('users')
          .insert([newUser])
          .select()
          .single();

        if (insertError) {
          setStatus(`❌ Failed to create user: ${insertError.message}`);
          console.error('Insert error:', insertError);
        } else {
          setStatus(`✅ User created successfully!`);
          console.log('Created user:', data);
        }
        setLoading(false);
      }
    } catch (err) {
      setStatus(`❌ Error: ${err.message}`);
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setStatus('Redirecting to Google...');
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.href,
        }
      });
      if (error) throw error;
    } catch (err) {
      setStatus(`❌ Login error: ${err.message}`);
    }
  };

  const handleLogout = async () => {
    try {
      setStatus('Logging out...');
      await supabase.auth.signOut();
      setUser(null);
      setStatus('✅ Logged out');
    } catch (err) {
      setStatus(`❌ Logout error: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{status}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
        <h1 className="text-2xl font-bold mb-4">Authentication Test</h1>
        
        <div className="mb-4 p-4 bg-gray-50 rounded-lg">
          <p className="font-mono text-sm break-all">{status}</p>
        </div>

        {user ? (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="font-semibold text-green-700">Logged in as:</p>
              <p className="text-sm">{user.email}</p>
              <p className="text-xs text-gray-500 mt-1">ID: {user.id}</p>
            </div>
            <button
              onClick={handleLogout}
              className="w-full bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700"
            >
              Logout
            </button>
          </div>
        ) : (
          <button
            onClick={handleGoogleLogin}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Test Google Login
          </button>
        )}

        <div className="mt-4 text-xs text-gray-400">
          <p>Debug info:</p>
          <p>URL: {window.location.href}</p>
          <p>Origin: {window.location.origin}</p>
        </div>
      </div>
    </div>
  );
}