import { LogOut, Wallet, CreditCard, Users, Moon, Sun } from 'lucide-react';
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
              <button
                onClick={logout}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg"
              >
                <LogOut className="w-5 h-5" /> Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Welcome Card */}
        <div className={`${
          theme === 'dark' ? 'bg-gray-800' : 'bg-white'
        } rounded-2xl shadow-xl p-8 text-center transition-colors duration-300 mb-8`}>
          <h2 className={`text-3xl font-bold ${
            theme === 'dark' ? 'text-white' : 'text-gray-800'
          }`}>
            Welcome back, {user?.username || 'User'}! 👋
          </h2>
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