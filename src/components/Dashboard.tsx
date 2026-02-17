import { LogOut, Wallet, CreditCard, Users, Moon, Sun, User as UserIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState<number | ''>('');
  const [balance, setBalance] = useState<number | null>(null);
  const [communityBalance, setCommunityBalance] = useState<number>(0);
  const [apiStatus, setApiStatus] = useState<'online' | 'offline'>('online');
  const [lastPayment, setLastPayment] = useState<{amount: number, date: string} | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [amountError, setAmountError] = useState<string>('');
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  
  // Use environment variable with fallback
  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://savingwork.onrender.com';

  // Fetch user balance and community balance when component mounts or user changes
  useEffect(() => {
    if (user?.id) {
      fetchUserBalance();
      fetchCommunityBalance();
      fetchRecentTransactions();
    }
    checkApiHealth();
  }, [user]);

  // Set up real-time subscription for balance updates
  useEffect(() => {
    if (!user?.id) return;

    const subscription = supabase
      .channel('user-balance-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
          filter: `id=eq.${user.id}`
        },
        (payload) => {
          console.log('🔄 Real-time balance update:', payload.new.balance);
          setBalance(payload.new.balance || 0);
          fetchCommunityBalance();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user]);

  const checkApiHealth = async () => {
    try {
      const response = await fetch(`${backendUrl}/api/health`);
      setApiStatus(response.ok ? 'online' : 'offline');
    } catch (error) {
      setApiStatus('offline');
    }
  };

  const fetchUserBalance = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('balance')
        .eq('id', user?.id)
        .single();
      
      if (!error && data) {
        setBalance(data.balance || 0);
      }
    } catch (error) {
      console.error('Error fetching balance:', error);
    }
  };

  const fetchCommunityBalance = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('balance');
      
      if (!error && data) {
        const total = data.reduce((sum, user) => sum + (user.balance || 0), 0);
        setCommunityBalance(total);
      }
    } catch (error) {
      console.error('Error fetching community balance:', error);
    }
  };

  const fetchRecentTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (!error && data) {
        setRecentTransactions(data);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    }
  };

  const validateAmount = (value: number): boolean => {
    if (value < 5) {
      setAmountError("Minimum payment amount is R5");
      return false;
    }
    if (value > 10000) {
      setAmountError("Maximum payment amount is R10,000");
      return false;
    }
    setAmountError('');
    return true;
  };

  const handleAmountChange = (value: string) => {
    if (value === '') {
      setAmount('');
      setAmountError('');
      return;
    }
    
    const numValue = Number(value);
    if (!isNaN(numValue)) {
      setAmount(numValue);
      validateAmount(numValue);
    }
  };

  const handlePresetAmount = (preset: number) => {
    setAmount(preset);
    validateAmount(preset);
  };

  const handlePayment = async () => {
    if (!user?.id) {
      alert("Please log in first");
      return;
    }

    if (amount === '') {
      alert("Please enter an amount");
      return;
    }

    if (!validateAmount(amount)) {
      return;
    }

    if (apiStatus === 'offline') {
      alert("Payment service is temporarily unavailable. Please try again later.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `${backendUrl}/api/payfast/create-payment`,
        {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify({
            amount: amount,
            userId: user.id
          }),
        }
      );

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Payment failed: ${res.status} - ${errorText}`);
      }

      const data = await res.json();
      
      if (data.url) {
        sessionStorage.setItem('pendingPayment', JSON.stringify({
          amount: amount,
          timestamp: new Date().toISOString()
        }));
        
        window.location.href = data.url;
      } else {
        alert('Payment initiation failed: No redirect URL received');
      }
    } catch (err) {
      console.error("Payment error:", err);
      alert(err instanceof Error ? err.message : "Payment failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Check for pending payment after redirect
  useEffect(() => {
    const pending = sessionStorage.getItem('pendingPayment');
    if (pending) {
      const payment = JSON.parse(pending);
      setLastPayment(payment);
      sessionStorage.removeItem('pendingPayment');
      fetchUserBalance();
      fetchCommunityBalance();
      fetchRecentTransactions();
    }
  }, []);

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: 2
    }).format(value);
  };

  // Get display name
  const getDisplayName = () => {
    if (user?.first_name && user?.last_name) {
      return `${user.first_name} ${user.last_name}`;
    }
    return user?.username || 'User';
  };

  // Get user initials for avatar
  const getUserInitials = () => {
    if (user?.first_name && user?.last_name) {
      return `${user.first_name[0]}${user.last_name[0]}`.toUpperCase();
    }
    return user?.username?.substring(0, 2).toUpperCase() || 'U';
  };

  if (apiStatus === 'offline') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 max-w-md text-center">
          <h2 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">Service Unavailable</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            Payment service is temporarily unavailable. Please try again later.
          </p>
          <button
            onClick={checkApiHealth}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      theme === 'dark' 
        ? 'dark bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900' 
        : 'bg-gradient-to-br from-blue-50 to-green-50'
    }`}>
      <nav className={`${
        theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white'
      } shadow-lg transition-colors duration-300`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <h1 className={`text-2xl font-bold ${
              theme === 'dark' ? 'text-white' : 'text-gray-800'
            }`}>
              Face Recognition App
            </h1>
            <div className="flex items-center gap-4">
              {/* Theme Toggle Button */}
              <button
                onClick={toggleTheme}
                className={`p-2 rounded-lg transition-colors duration-200 ${
                  theme === 'dark' 
                    ? 'bg-gray-700 text-yellow-400 hover:bg-gray-600' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>

              {apiStatus === 'online' && (
                <span className="text-sm text-green-600 dark:text-green-400">● Online</span>
              )}

              {/* User Profile Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="flex items-center gap-2 focus:outline-none"
                >
                  {user?.avatar_url ? (
                    <img 
                      src={user.avatar_url} 
                      alt={getDisplayName()}
                      className="w-8 h-8 rounded-full border-2 border-green-500"
                    />
                  ) : (
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                      theme === 'dark'
                        ? 'bg-green-600 text-white'
                        : 'bg-green-100 text-green-700'
                    }`}>
                      {getUserInitials()}
                    </div>
                  )}
                </button>

                {/* Dropdown Menu */}
                {showProfileMenu && (
                  <>
                    <div 
                      className="fixed inset-0 z-10"
                      onClick={() => setShowProfileMenu(false)}
                    ></div>
                    <div className={`absolute right-0 mt-2 w-64 rounded-lg shadow-lg py-2 z-20 ${
                      theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white'
                    }`}>
                      <div className={`px-4 py-3 border-b ${
                        theme === 'dark' ? 'border-gray-700' : 'border-gray-100'
                      }`}>
                        <p className={`text-sm font-medium ${
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-500'
                        }`}>Signed in as</p>
                        <p className={`text-sm font-semibold mt-1 ${
                          theme === 'dark' ? 'text-white' : 'text-gray-800'
                        }`}>{user?.email || user?.username}</p>
                      </div>
                      
                      {user?.provider === 'google' && (
                        <div className={`px-4 py-2 text-xs ${
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                          <span className="flex items-center gap-1">
                            <svg className="w-3 h-3" viewBox="0 0 24 24">
                              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                            </svg>
                            Connected with Google
                          </span>
                        </div>
                      )}

                      <button
                        onClick={logout}
                        className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                          theme === 'dark'
                            ? 'text-red-400 hover:bg-gray-700'
                            : 'text-red-600 hover:bg-gray-100'
                        }`}
                      >
                        Sign Out
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Welcome Card */}
        <div className={`${
          theme === 'dark' ? 'bg-gray-800' : 'bg-white'
        } rounded-2xl shadow-xl p-8 text-center transition-colors duration-300 mb-8`}>
          <div className="flex items-center justify-center gap-4 mb-4">
            {user?.avatar_url ? (
              <img 
                src={user.avatar_url} 
                alt={getDisplayName()}
                className="w-16 h-16 rounded-full border-4 border-green-500"
              />
            ) : (
              <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold ${
                theme === 'dark'
                  ? 'bg-green-600 text-white'
                  : 'bg-green-100 text-green-700'
              }`}>
                {getUserInitials()}
              </div>
            )}
          </div>
          <h2 className={`text-3xl font-bold ${
            theme === 'dark' ? 'text-white' : 'text-gray-800'
          }`}>
            Welcome back, {getDisplayName()}! 👋
          </h2>
          {user?.provider === 'google' && (
            <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 bg-blue-50 dark:bg-blue-900/20 rounded-full">
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span className="text-sm text-blue-600 dark:text-blue-400">Google Account</span>
            </div>
          )}
          {user?.email && (
            <p className={`mt-2 text-sm ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
            }`}>
              {user.email}
            </p>
          )}
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Balance Card */}
          <div className={`${
            theme === 'dark' ? 'bg-gray-800 hover:bg-gray-750' : 'bg-white hover:shadow-xl'
          } rounded-xl shadow-lg p-6 text-center transform hover:scale-105 transition-all duration-300`}>
            <Wallet className={`w-12 h-12 mx-auto ${
              theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
            }`} />
            <div className={`text-2xl font-bold mt-3 ${
              theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
            }`}>
              Your Balance
            </div>
            <p className={`text-3xl font-bold mt-2 ${
              theme === 'dark' ? 'text-white' : 'text-gray-800'
            }`}>
              {formatCurrency(balance ?? 0)}
            </p>
            {lastPayment && (
              <p className="text-xs text-green-600 dark:text-green-400 mt-1 animate-pulse">
                +{formatCurrency(lastPayment.amount)} added
              </p>
            )}
          </div>

          {/* Payment Card */}
          <div className={`${
            theme === 'dark' ? 'bg-gray-800 hover:bg-gray-750' : 'bg-white hover:shadow-xl'
          } rounded-xl shadow-lg p-6 text-center transform hover:scale-105 transition-all duration-300`}>
            <CreditCard className={`w-12 h-12 mx-auto ${
              theme === 'dark' ? 'text-green-400' : 'text-green-600'
            }`} />
            <div className={`text-2xl font-bold mt-3 ${
              theme === 'dark' ? 'text-green-400' : 'text-green-600'
            }`}>
              Make a Deposit
            </div>
            
            <div className="mt-4">
              <div className="flex items-center justify-center gap-2 mb-3">
                <span className={`text-2xl font-bold ${
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                }`}>R</span>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  min="5"
                  max="10000"
                  step="1"
                  className={`w-32 text-center text-2xl font-bold px-4 py-2 border-2 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                    theme === 'dark' 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-green-200 text-gray-900'
                  }`}
                  placeholder="Amount"
                />
              </div>
              
              {/* Quick amount buttons */}
              <div className="grid grid-cols-4 gap-2 mb-2">
                {[5, 10, 15, 20].map((preset) => (
                  <button
                    key={preset}
                    onClick={() => handlePresetAmount(preset)}
                    className={`py-2 px-3 rounded-lg text-sm font-semibold transition-all ${
                      amount === preset 
                        ? 'bg-green-600 text-white' 
                        : theme === 'dark'
                          ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    R {preset}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-4 gap-2 mb-2">
                {[25, 30, 40, 50].map((preset) => (
                  <button
                    key={preset}
                    onClick={() => handlePresetAmount(preset)}
                    className={`py-2 px-3 rounded-lg text-sm font-semibold transition-all ${
                      amount === preset 
                        ? 'bg-green-600 text-white' 
                        : theme === 'dark'
                          ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    R {preset}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-4 gap-2 mb-2">
                {[75, 100, 150, 200].map((preset) => (
                  <button
                    key={preset}
                    onClick={() => handlePresetAmount(preset)}
                    className={`py-2 px-3 rounded-lg text-sm font-semibold transition-all ${
                      amount === preset 
                        ? 'bg-green-600 text-white' 
                        : theme === 'dark'
                          ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    R {preset}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-4 gap-2 mb-2">
                {[300, 400, 500, 1000].map((preset) => (
                  <button
                    key={preset}
                    onClick={() => handlePresetAmount(preset)}
                    className={`py-2 px-3 rounded-lg text-sm font-semibold transition-all ${
                      amount === preset 
                        ? 'bg-green-600 text-white' 
                        : theme === 'dark'
                          ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    R {preset}
                  </button>
                ))}
              </div>
              
              {amountError && (
                <p className="text-xs text-red-500 dark:text-red-400 mb-2">{amountError}</p>
              )}
              
              <p className={`text-xs ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              }`}>Min: R5 | Max: R10,000</p>
            </div>

            <button
              onClick={handlePayment}
              disabled={loading || amount === '' || !!amountError}
              className={`mt-2 w-full py-3 px-4 rounded-lg text-white font-semibold transition-all duration-200 ${
                loading || amount === '' || amountError
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-green-600 hover:bg-green-700 hover:scale-105'
              }`}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </span>
              ) : (
                `Pay R ${amount || '...'}`
              )}
            </button>
          </div>

          {/* Community Card */}
          <div className={`${
            theme === 'dark' ? 'bg-gray-800 hover:bg-gray-750' : 'bg-white hover:shadow-xl'
          } rounded-xl shadow-lg p-6 text-center transform hover:scale-105 transition-all duration-300`}>
            <Users className={`w-12 h-12 mx-auto ${
              theme === 'dark' ? 'text-orange-400' : 'text-orange-600'
            }`} />
            <div className={`text-2xl font-bold mt-3 ${
              theme === 'dark' ? 'text-orange-400' : 'text-orange-600'
            }`}>
              Community Balance
            </div>
            <p className={`text-4xl font-bold mt-2 ${
              theme === 'dark' ? 'text-white' : 'text-gray-800'
            }`}>
              {formatCurrency(communityBalance)}
            </p>
            <p className={`text-sm mt-2 ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            }`}>Total savings across all users</p>
          </div>
        </div>

        {/* Recent Transactions */}
        <div className={`mt-8 ${
          theme === 'dark' ? 'bg-gray-800' : 'bg-white'
        } rounded-xl shadow-lg p-6 transition-colors duration-300`}>
          <h3 className={`text-xl font-bold mb-4 ${
            theme === 'dark' ? 'text-white' : 'text-gray-800'
          }`}>Recent Transactions</h3>
          <div className="space-y-3">
            {recentTransactions.length > 0 ? (
              recentTransactions.map((tx, index) => (
                <div key={index} className={`flex justify-between items-center p-3 rounded-lg ${
                  theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50'
                }`}>
                  <div>
                    <p className={`font-semibold ${
                      theme === 'dark' ? 'text-white' : 'text-gray-800'
                    }`}>Deposit</p>
                    <p className={`text-sm ${
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      {new Date(tx.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <p className="text-green-600 dark:text-green-400 font-bold">+ {formatCurrency(tx.amount)}</p>
                </div>
              ))
            ) : (
              <p className={`text-center py-4 ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              }`}>No transactions yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}