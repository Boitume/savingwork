import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import FaceLogin from './components/FaceLogin';
import FaceRegistration from './components/FaceRegistration';
import Dashboard from './components/Dashboard';
import { User } from './lib/supabase';
import { Sun, Moon } from 'lucide-react';

function AppContent() {
  const { user, login, signInWithGoogle, loading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [view, setView] = useState<'login' | 'register'>('login');
  const [googleLoading, setGoogleLoading] = useState(false);

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (user) {
    return <Dashboard />;
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
            Face Recognition Login
          </h1>
          <p className={`${
            theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
          }`}>
            Secure and passwordless authentication
          </p>
        </div>

        {/* Google Sign-In Button */}
        <div className="flex justify-center mb-6">
          <button
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
            className={`flex items-center gap-3 px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
              theme === 'dark'
                ? 'bg-white text-gray-800 hover:bg-gray-100'
                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
            } shadow-md hover:shadow-lg transform hover:scale-105`}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span>{googleLoading ? 'Signing in...' : 'Continue with Google'}</span>
          </button>
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
          <p>© 2026 Face Recognition App. All rights reserved.</p>
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