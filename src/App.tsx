import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import FaceLogin from './components/FaceLogin';
import FaceRegistration from './components/FaceRegistration';
import Dashboard from './components/Dashboard';
import { User } from './lib/supabase';
import { Sun, Moon } from 'lucide-react';

function AppContent() {
  const { user, login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [view, setView] = useState<'login' | 'register'>('login');

  const handleLoginSuccess = (user: User) => {
    login(user);
  };

  const handleRegisterSuccess = () => {
    setView('login');
  };

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
            Login
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
            Register
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