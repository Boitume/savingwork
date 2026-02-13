import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import FaceLogin from './components/FaceLogin';
import FaceRegistration from './components/FaceRegistration';
import Dashboard from './components/Dashboard';
import { User } from './lib/supabase';

function AppContent() {
  const { user, login } = useAuth();
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Face Recognition Login</h1>
          <p className="text-gray-600">Secure and passwordless authentication</p>
        </div>

        <div className="flex justify-center gap-4 mb-8">
          <button
            onClick={() => setView('login')}
            className={`px-6 py-2 rounded-lg font-medium transition-colors duration-200 ${
              view === 'login'
                ? 'bg-green-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            Login
          </button>
          <button
            onClick={() => setView('register')}
            className={`px-6 py-2 rounded-lg font-medium transition-colors duration-200 ${
              view === 'register'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
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
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
