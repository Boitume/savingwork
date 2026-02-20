import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import FaceLogin from './components/FaceLogin';
import FaceRegistration from './components/FaceRegistration';
import Dashboard from './components/Dashboard';
import { User } from './lib/supabase';
import { Sun, Moon, Fingerprint, Smartphone, Key } from 'lucide-react';
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';

function AppContent() {
  const { user, login, signInWithGoogle, loading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [view, setView] = useState<'login' | 'register'>('login');
  const [googleLoading, setGoogleLoading] = useState(false);
  const [fingerprintLoading, setFingerprintLoading] = useState(false);
  const [showFingerprintModal, setShowFingerprintModal] = useState(false);
  const [fingerprintEmail, setFingerprintEmail] = useState('');
  const [fingerprintStep, setFingerprintStep] = useState<'login' | 'register'>('login');
  const [devices, setDevices] = useState<any[]>([]);
  const [showDeviceManager, setShowDeviceManager] = useState(false);

  // Fetch user's registered fingerprint devices if logged in
  useEffect(() => {
    if (user?.id) {
      fetchDevices();
    }
  }, [user]);

  const fetchDevices = async () => {
    try {
      const response = await fetch(`/api/webauthn/devices/${user?.id}`);
      const data = await response.json();
      setDevices(data.devices || []);
    } catch (error) {
      console.error('Error fetching devices:', error);
    }
  };

  const handleLoginSuccess = (user: User) => {
    login(user);
  };

  const handleRegisterSuccess = () => {
    setView('login');
  };

  const handleGoogleSignIn = async () => {
    try {
      setGoogleLoading(true);
      await signInWithGoogle();
    } catch (error) {
      console.error('Google sign-in error:', error);
    } finally {
      setGoogleLoading(false);
    }
  };

  // Handle fingerprint login
  const handleFingerprintLogin = async () => {
    try {
      setFingerprintLoading(true);
      
      // Step 1: Get authentication options from server
      const optsResponse = await fetch('/api/webauthn/login/begin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      
      const optsData = await optsResponse.json();
      
      if (optsData.error || optsData === null) {
        // No fingerprint registered - show registration modal
        setFingerprintStep('register');
        setShowFingerprintModal(true);
        setFingerprintLoading(false);
        return;
      }
      
      // Step 2: Start browser authentication (fingerprint scan)
      const authResp = await startAuthentication({ optionsJSON: optsData });
      
      // Step 3: Verify with server
      const verifResp = await fetch('/api/webauthn/login/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credential: authResp,
          challengeId: optsData.challengeId
        })
      });
      
      const verifData = await verifResp.json();
      
      if (verifData.verified && verifData.user) {
        console.log('✅ Fingerprint login successful');
        login(verifData.user);
      } else {
        alert('Fingerprint authentication failed');
      }
    } catch (error) {
      console.error('Fingerprint login error:', error);
      alert('Fingerprint authentication failed');
    } finally {
      setFingerprintLoading(false);
      setShowFingerprintModal(false);
    }
  };

  // Handle fingerprint registration
  const handleFingerprintRegister = async () => {
    if (!fingerprintEmail) {
      alert('Please enter your email');
      return;
    }

    try {
      setFingerprintLoading(true);
      
      // First, check if user exists or create them
      const { data: { session } } = await supabase.auth.signInWithOtp({
        email: fingerprintEmail,
        options: {
          shouldCreateUser: true,
        }
      });

      // Step 1: Get registration options from server
      const optsResponse = await fetch('/api/webauthn/register/begin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: session?.user?.id || fingerprintEmail,
          username: fingerprintEmail.split('@')[0]
        })
      });
      
      const optsData = await optsResponse.json();
      
      if (optsData.error) {
        console.error('Registration options error:', optsData.error);
        alert('Failed to start fingerprint registration');
        return;
      }
      
      // Step 2: Start browser registration (fingerprint scan)
      const attResp = await startRegistration({ optionsJSON: optsData });
      
      // Step 3: Verify with server
      const verifResp = await fetch('/api/webauthn/register/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: session?.user?.id || fingerprintEmail,
          credential: attResp
        })
      });
      
      const verifData = await verifResp.json();
      
      if (verifData.verified) {
        console.log('✅ Fingerprint registered successfully');
        alert('Fingerprint registered successfully! You can now login with your fingerprint.');
        setShowFingerprintModal(false);
        setFingerprintEmail('');
      } else {
        alert('Fingerprint registration failed');
      }
    } catch (error) {
      console.error('Fingerprint registration error:', error);
      alert('Fingerprint registration failed');
    } finally {
      setFingerprintLoading(false);
    }
  };

  const handleRemoveDevice = async (deviceId: string) => {
    if (!user) return;
    
    try {
      const response = await fetch(`/api/webauthn/devices/${deviceId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });
      
      if (response.ok) {
        alert('Device removed successfully');
        fetchDevices(); // Refresh list
      }
    } catch (error) {
      console.error('Error removing device:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (user) {
    return (
      <>
        <Dashboard />
        {/* Fingerprint Device Manager - appears at bottom right */}
        <div className="fixed bottom-4 right-4 z-50">
          <button
            onClick={() => setShowDeviceManager(!showDeviceManager)}
            className="p-3 bg-purple-600 text-white rounded-full shadow-lg hover:bg-purple-700 transition-colors"
            title="Manage fingerprint devices"
          >
            <Fingerprint className="w-6 h-6" />
          </button>
          
          {showDeviceManager && (
            <div className={`absolute bottom-16 right-0 w-80 rounded-lg shadow-xl p-4 ${
              theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white'
            }`}>
              <h3 className={`font-bold mb-3 ${
                theme === 'dark' ? 'text-white' : 'text-gray-800'
              }`}>
                Fingerprint Devices
              </h3>
              
              {devices.length === 0 ? (
                <p className={`text-sm mb-3 ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  No fingerprint devices registered yet.
                </p>
              ) : (
                <div className="space-y-2 mb-3 max-h-60 overflow-y-auto">
                  {devices.map((device) => (
                    <div key={device.id} className={`p-2 rounded flex justify-between items-center ${
                      theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                    }`}>
                      <div>
                        <p className={`text-sm font-medium ${
                          theme === 'dark' ? 'text-white' : 'text-gray-800'
                        }`}>
                          {device.device_type || 'Unknown device'}
                        </p>
                        <p className={`text-xs ${
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                          Added: {new Date(device.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRemoveDevice(device.id)}
                        className="text-red-500 hover:text-red-700 text-xs font-medium"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              <button
                onClick={() => setShowDeviceManager(false)}
                className={`w-full text-sm font-medium py-2 px-3 rounded-lg transition-colors ${
                  theme === 'dark'
                    ? 'bg-gray-700 hover:bg-gray-600 text-white'
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
                }`}
              >
                Close
              </button>
            </div>
          )}
        </div>
      </>
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      theme === 'dark' 
        ? 'dark bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900' 
        : 'bg-gradient-to-br from-blue-50 to-green-50'
    } py-12 px-4`}>
      
      {/* Theme Toggle Button */}
      <div className="fixed top-4 right-4 z-50">
        <button
          onClick={toggleTheme}
          className={`p-3 rounded-full shadow-lg transition-colors duration-200 ${
            theme === 'dark' 
              ? 'bg-gray-800 text-yellow-400 hover:bg-gray-700 border border-gray-700' 
              : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
          }`}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
      </div>

      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className={`text-4xl font-bold mb-2 ${
            theme === 'dark' ? 'text-white' : 'text-gray-800'
          }`}>
            Secure Authentication
          </h1>
          <p className={`${
            theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
          }`}>
            Choose your preferred login method
          </p>
        </div>

        {/* Authentication Options Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {/* Google Sign-In */}
          <button
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
            className={`flex flex-col items-center gap-3 p-6 rounded-xl font-medium transition-all duration-200 ${
              theme === 'dark'
                ? 'bg-gray-800 text-white hover:bg-gray-700 border border-gray-700'
                : 'bg-white text-gray-800 hover:shadow-xl border border-gray-200'
            } shadow-md hover:scale-105`}
          >
            <svg className="w-8 h-8" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span>{googleLoading ? 'Signing in...' : 'Google'}</span>
          </button>

          {/* Fingerprint Login */}
          <button
            onClick={handleFingerprintLogin}
            disabled={fingerprintLoading}
            className={`flex flex-col items-center gap-3 p-6 rounded-xl font-medium transition-all duration-200 ${
              theme === 'dark'
                ? 'bg-gray-800 text-white hover:bg-gray-700 border border-gray-700'
                : 'bg-white text-gray-800 hover:shadow-xl border border-gray-200'
            } shadow-md hover:scale-105`}
          >
            <Fingerprint className="w-8 h-8 text-purple-600" />
            <span>{fingerprintLoading ? 'Scanning...' : 'Fingerprint'}</span>
          </button>

          {/* Face Login */}
          <button
            onClick={() => setView('login')}
            className={`flex flex-col items-center gap-3 p-6 rounded-xl font-medium transition-all duration-200 ${
              view === 'login'
                ? 'bg-green-600 text-white'
                : theme === 'dark'
                  ? 'bg-gray-800 text-white hover:bg-gray-700 border border-gray-700'
                  : 'bg-white text-gray-800 hover:shadow-xl border border-gray-200'
            } shadow-md hover:scale-105`}
          >
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span>Face Login</span>
          </button>

          {/* Register Fingerprint Button */}
          <button
            onClick={() => {
              setFingerprintStep('register');
              setShowFingerprintModal(true);
            }}
            className={`flex flex-col items-center gap-3 p-6 rounded-xl font-medium transition-all duration-200 ${
              theme === 'dark'
                ? 'bg-purple-900 text-white hover:bg-purple-800 border border-purple-700'
                : 'bg-purple-100 text-purple-800 hover:bg-purple-200 border border-purple-300'
            } shadow-md hover:scale-105`}
          >
            <Smartphone className="w-8 h-8" />
            <span>Register Fingerprint</span>
          </button>
        </div>

        {/* Fingerprint Registration Modal */}
        {showFingerprintModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className={`max-w-md w-full rounded-xl shadow-2xl p-6 ${
              theme === 'dark' ? 'bg-gray-800' : 'bg-white'
            }`}>
              <h2 className={`text-2xl font-bold mb-4 ${
                theme === 'dark' ? 'text-white' : 'text-gray-800'
              }`}>
                {fingerprintStep === 'login' ? 'Login with Fingerprint' : 'Register Fingerprint'}
              </h2>
              
              <p className={`mb-4 text-sm ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
              }`}>
                {fingerprintStep === 'login' 
                  ? 'Scan your fingerprint to login.' 
                  : 'Enter your email to register your fingerprint. You can then login with your fingerprint anytime.'}
              </p>
              
              {fingerprintStep === 'register' && (
                <input
                  type="email"
                  value={fingerprintEmail}
                  onChange={(e) => setFingerprintEmail(e.target.value)}
                  placeholder="Enter your email"
                  className={`w-full px-4 py-2 mb-4 rounded-lg border ${
                    theme === 'dark'
                      ? 'bg-gray-700 border-gray-600 text-white'
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                />
              )}
              
              <div className="flex gap-3">
                <button
                  onClick={fingerprintStep === 'login' ? handleFingerprintLogin : handleFingerprintRegister}
                  disabled={fingerprintLoading}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:bg-gray-400"
                >
                  {fingerprintLoading ? 'Processing...' : fingerprintStep === 'login' ? 'Scan Fingerprint' : 'Register'}
                </button>
                <button
                  onClick={() => {
                    setShowFingerprintModal(false);
                    setFingerprintEmail('');
                  }}
                  className={`flex-1 font-medium py-2 px-4 rounded-lg transition-colors ${
                    theme === 'dark'
                      ? 'bg-gray-700 hover:bg-gray-600 text-white'
                      : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
                  }`}
                >
                  Cancel
                </button>
              </div>
              
              {fingerprintStep === 'login' && (
                <button
                  onClick={() => setFingerprintStep('register')}
                  className="mt-3 text-sm text-purple-600 hover:text-purple-800 dark:text-purple-400"
                >
                  Don't have fingerprint registered? Register here
                </button>
              )}
            </div>
          </div>
        )}

        {/* Divider */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className={`h-px w-24 ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-300'}`}></div>
          <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>or</span>
          <div className={`h-px w-24 ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-300'}`}></div>
        </div>

        {/* Face Auth Tabs */}
        <div className="flex justify-center gap-4 mb-8">
          <button
            onClick={() => setView('login')}
            className={`px-6 py-2 rounded-lg font-medium transition-colors duration-200 ${
              view === 'login'
                ? 'bg-green-600 text-white'
                : theme === 'dark'
                  ? 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            Face Login
          </button>
          <button
            onClick={() => setView('register')}
            className={`px-6 py-2 rounded-lg font-medium transition-colors duration-200 ${
              view === 'register'
                ? 'bg-blue-600 text-white'
                : theme === 'dark'
                  ? 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            Face Register
          </button>
        </div>

        {view === 'login' ? (
          <FaceLogin onSuccess={handleLoginSuccess} />
        ) : (
          <FaceRegistration onSuccess={handleRegisterSuccess} />
        )}

        {/* Footer */}
        <div className={`mt-8 text-center text-sm ${
          theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
        }`}>
          <p>© 2026 Face Recognition App. All rights reserved.</p>
          <p className="mt-1">Supports Google, Fingerprint, and Face Authentication</p>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;