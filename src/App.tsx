import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import FaceLogin from './components/FaceLogin';
import FaceRegistration from './components/FaceRegistration';
import Dashboard from './components/Dashboard';
import { User } from './lib/supabase';
import { Sun, Moon, Fingerprint, Smartphone, Key, Loader } from 'lucide-react';
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import { InstallPrompt } from './components/InstallPrompt';
import { PersistentInstallButton } from './components/PersistentInstallButton';

function AppContent() {
  const { user, login, signInWithGoogle, loading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [view, setView] = useState<'login' | 'register'>('login');
  const [googleLoading, setGoogleLoading] = useState(false);
  const [fingerprintLoading, setFingerprintLoading] = useState(false);
  const [fingerprintStatus, setFingerprintStatus] = useState<string>('');
  const [showFingerprintModal, setShowFingerprintModal] = useState(false);
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
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/webauthn/devices/${user?.id}`);
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

  // PURE FINGERPRINT LOGIN - Like banking apps (no email required)
  const handleFingerprintLogin = async () => {
    try {
      setFingerprintLoading(true);
      setFingerprintStatus('Checking for registered devices...');
      
      // Step 1: Check if any devices are registered in the system
      const checkResponse = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/webauthn/has-devices`);
      if (!checkResponse.ok) {
        throw new Error('Failed to check devices');
      }
      const { hasDevices } = await checkResponse.json();
      
      if (!hasDevices) {
        setFingerprintStatus('No devices found. Setting up first-time registration...');
        setTimeout(() => {
          setShowFingerprintModal(true);
          setFingerprintStatus('');
        }, 1000);
        setFingerprintLoading(false);
        return;
      }
      
      // Step 2: Get authentication options from server
      setFingerprintStatus('Preparing authentication...');
      console.log('📡 Calling login begin endpoint...');
      
      const optsResponse = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/webauthn/login/begin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      
      console.log('📡 Response status:', optsResponse.status);
      
      if (!optsResponse.ok) {
        const errorData = await optsResponse.json();
        console.error('❌ Login begin failed:', errorData);
        
        if (optsResponse.status === 404) {
          setFingerprintStatus('No fingerprint registered. Please register first.');
        } else {
          setFingerprintStatus(`Error: ${errorData.error || 'Unknown error'}`);
        }
        
        setTimeout(() => setFingerprintStatus(''), 3000);
        setFingerprintLoading(false);
        return;
      }
      
      const optsData = await optsResponse.json();
      console.log('✅ Login options received');
      
      // Step 3: Start browser authentication (fingerprint scan)
      setFingerprintStatus('Scan your fingerprint...');
      const authResp = await startAuthentication({ optionsJSON: optsData });
      
      // Step 4: Verify with server
      setFingerprintStatus('Verifying...');
      const verifResp = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/webauthn/login/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credential: authResp,
          challengeId: optsData.challengeId
        })
      });
      
      if (!verifResp.ok) {
        const errorData = await verifResp.json();
        throw new Error(errorData.error || 'Verification failed');
      }
      
      const verifData = await verifResp.json();
      
      if (verifData.verified && verifData.user) {
        setFingerprintStatus('Login successful!');
        console.log('✅ Fingerprint login successful');
        login(verifData.user);
      } else {
        throw new Error('Authentication failed');
      }
    } catch (error: any) {
      console.error('❌ Fingerprint login error:', error);
      
      if (error.name === 'NotAllowedError') {
        setFingerprintStatus('Authentication cancelled');
      } else if (error.name === 'NotFoundError') {
        setFingerprintStatus('No fingerprint device found');
        setTimeout(() => {
          setShowFingerprintModal(true);
        }, 1500);
      } else {
        setFingerprintStatus(`Error: ${error.message || 'Authentication failed'}`);
      }
      
      setTimeout(() => setFingerprintStatus(''), 3000);
    } finally {
      setFingerprintLoading(false);
    }
  };

  // Handle fingerprint registration for new users
  const handleRegisterFingerprint = async () => {
    try {
      setFingerprintLoading(true);
      setFingerprintStatus('Preparing registration...');
      setShowFingerprintModal(false);
      
      // Step 1: Get registration options from server
      const optsResponse = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/webauthn/register/begin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      
      if (!optsResponse.ok) {
        const errorData = await optsResponse.json();
        throw new Error(errorData.error || 'Failed to start registration');
      }
      
      const optsData = await optsResponse.json();
      
      // Step 2: Start browser registration (fingerprint scan)
      setFingerprintStatus('Scan your fingerprint to register...');
      const attResp = await startRegistration({ optionsJSON: optsData });
      
      // Step 3: Verify with server
      setFingerprintStatus('Completing registration...');
      const verifResp = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/webauthn/register/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credential: attResp,
          challengeId: optsData.challengeId
        })
      });
      
      if (!verifResp.ok) {
        const errorData = await verifResp.json();
        throw new Error(errorData.error || 'Registration failed');
      }
      
      const verifData = await verifResp.json();
      
      if (verifData.verified && verifData.user) {
        setFingerprintStatus('Registration successful! Logging you in...');
        console.log('✅ Fingerprint registered successfully');
        
        setTimeout(() => {
          login(verifData.user);
        }, 1000);
      } else {
        throw new Error('Registration verification failed');
      }
    } catch (error: any) {
      console.error('❌ Fingerprint registration error:', error);
      
      if (error.name === 'NotAllowedError') {
        setFingerprintStatus('Registration cancelled');
      } else {
        setFingerprintStatus(`Error: ${error.message || 'Registration failed'}`);
      }
      
      setTimeout(() => setFingerprintStatus(''), 3000);
    } finally {
      setFingerprintLoading(false);
    }
  };

  // Handle remove device
  const handleRemoveDevice = async (deviceId: string) => {
    if (!user) return;
    
    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/webauthn/devices/${deviceId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });
      
      if (response.ok) {
        alert('Device removed successfully');
        fetchDevices();
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
        {/* Fingerprint Device Manager */}
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
                onClick={handleRegisterFingerprint}
                disabled={fingerprintLoading}
                className="w-full mb-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium py-2 px-3 rounded-lg transition-colors disabled:bg-gray-400"
              >
                {fingerprintLoading ? 'Registering...' : 'Register New Fingerprint'}
              </button>
              
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
            Like banking apps - Just tap and go!
          </p>
        </div>

        {/* Authentication Options Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
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
            className={`flex flex-col items-center gap-3 p-6 rounded-xl font-medium transition-all duration-200 relative ${
              theme === 'dark'
                ? 'bg-gray-800 text-white hover:bg-gray-700 border border-gray-700'
                : 'bg-white text-gray-800 hover:shadow-xl border border-gray-200'
            } shadow-md hover:scale-105`}
          >
            <Fingerprint className={`w-8 h-8 text-purple-600 ${
              fingerprintLoading ? 'animate-pulse' : ''
            }`} />
            <span>
              {fingerprintLoading ? 'Processing...' : 'Fingerprint Login'}
            </span>
            
            {/* Status overlay */}
            {fingerprintStatus && (
              <div className={`absolute inset-0 flex items-center justify-center rounded-xl ${
                theme === 'dark' ? 'bg-gray-800/95' : 'bg-white/95'
              } backdrop-blur-sm`}>
                <div className="flex items-center gap-2">
                  {fingerprintStatus.includes('Scan') && (
                    <Fingerprint className="w-5 h-5 text-purple-600 animate-pulse" />
                  )}
                  {fingerprintStatus.includes('Verifying') && (
                    <Loader className="w-5 h-5 text-purple-600 animate-spin" />
                  )}
                  <span className="text-sm font-medium">{fingerprintStatus}</span>
                </div>
              </div>
            )}
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
        </div>

        {/* First-time Registration Modal */}
        {showFingerprintModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className={`rounded-lg p-6 max-w-md w-full ${
              theme === 'dark' ? 'bg-gray-800' : 'bg-white'
            }`}>
              <div className="text-center mb-4">
                <Fingerprint className="w-16 h-16 text-purple-600 mx-auto mb-2" />
                <h3 className={`text-xl font-bold ${
                  theme === 'dark' ? 'text-white' : 'text-gray-800'
                }`}>
                  Set Up Fingerprint Login
                </h3>
              </div>
              
              <p className={`text-sm mb-6 ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
              }`}>
                Like banking apps, you can use your fingerprint to securely log in. 
                This will create your account and register your fingerprint in one step.
              </p>
              
              <div className="bg-purple-50 dark:bg-gray-700 p-4 rounded-lg mb-6">
                <p className="text-sm text-purple-800 dark:text-purple-200">
                  <strong>🔒 Secure & Private:</strong> Your fingerprint never leaves your device. 
                  We only store an encrypted mathematical representation.
                </p>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={handleRegisterFingerprint}
                  disabled={fingerprintLoading}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:bg-gray-400 flex items-center justify-center gap-2"
                >
                  {fingerprintLoading ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      <span>Setting up...</span>
                    </>
                  ) : (
                    <>
                      <Fingerprint className="w-4 h-4" />
                      <span>Set Up Fingerprint</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowFingerprintModal(false)}
                  className={`flex-1 font-medium py-3 px-4 rounded-lg transition-colors ${
                    theme === 'dark'
                      ? 'bg-gray-700 hover:bg-gray-600 text-white'
                      : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
                  }`}
                >
                  Later
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Info Box */}
        <div className={`text-center p-4 rounded-lg mb-6 ${
          theme === 'dark' ? 'bg-gray-800' : 'bg-blue-50'
        }`}>
          <p className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>
            <Fingerprint className="inline w-5 h-5 mr-2 text-purple-600" />
            <strong>Like ABSA & TymeBank:</strong> Just tap the fingerprint icon to login
          </p>
        </div>

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
          <p>© 2026 Secure Authentication App. All rights reserved.</p>
          <p className="mt-1">Pure biometric login - Just like your banking app</p>
        </div>
      </div>
      {!user && <InstallPrompt />}
      
      {!user && <PersistentInstallButton />}
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