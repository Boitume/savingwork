import { LogOut, User as UserIcon, Wallet, CreditCard, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState<number | ''>('');
  const [balance, setBalance] = useState<number | null>(null);
  const [communityBalance, setCommunityBalance] = useState<number>(0);
  const [apiStatus, setApiStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [lastPayment, setLastPayment] = useState<{amount: number, date: string} | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [amountError, setAmountError] = useState<string>('');
  
  // Use environment variable with fallback
  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://savingwork.onrender.com';

  // Debug: Log user info when component mounts or user changes
  console.log('🔍 DEBUG: Current user object:', user);
  console.log('🔍 DEBUG: User ID:', user?.id);
  console.log('🔍 DEBUG: Username:', user?.username);
  console.log('🔍 DEBUG: Backend URL:', backendUrl);

  // Fetch user balance and community balance when component mounts or user changes
  useEffect(() => {
    console.log('🔍 DEBUG: Dashboard mounted, checking API health...');
    checkApiHealth();
    
    if (user?.id) {
      fetchUserBalance();
      fetchCommunityBalance();
      fetchRecentTransactions();
    }
  }, [user]);

  // Also log when user changes
  useEffect(() => {
    console.log('🔍 DEBUG: User state changed:', user);
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
      console.log('🔍 DEBUG: Checking API health at:', `${backendUrl}/api/health`);
      const response = await fetch(`${backendUrl}/api/health`);
      console.log('🔍 DEBUG: API Health Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Backend API is online:', data);
        setApiStatus('online');
      } else {
        console.error('❌ Backend API returned error:', response.status);
        setApiStatus('offline');
      }
    } catch (error) {
      console.error('❌ Cannot reach backend API:', error);
      setApiStatus('offline');
    }
  };

  const fetchUserBalance = async () => {
    try {
      console.log('💰 Fetching user balance for:', user?.id);
      
      const { data, error } = await supabase
        .from('users')
        .select('balance')
        .eq('id', user?.id)
        .single();
      
      if (error) {
        console.error('❌ Error fetching balance:', error);
        return;
      }
      
      console.log('💰 User balance fetched:', data?.balance);
      setBalance(data?.balance || 0);
    } catch (error) {
      console.error('❌ Error fetching balance:', error);
    }
  };

  const fetchCommunityBalance = async () => {
    try {
      console.log('🌍 Fetching community balance...');
      
      const { data, error } = await supabase
        .from('users')
        .select('balance');
      
      if (error) {
        console.error('❌ Error fetching community balance:', error);
        return;
      }
      
      if (data) {
        const total = data.reduce((sum, user) => sum + (user.balance || 0), 0);
        console.log('🌍 Community balance:', total);
        setCommunityBalance(total);
      }
    } catch (error) {
      console.error('❌ Error fetching community balance:', error);
    }
  };

  const fetchRecentTransactions = async () => {
    try {
      console.log('📊 Fetching recent transactions...');
      
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (error) {
        console.error('❌ Error fetching transactions:', error);
        return;
      }
      
      console.log('📊 Recent transactions:', data);
      setRecentTransactions(data || []);
    } catch (error) {
      console.error('❌ Error fetching transactions:', error);
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
      console.error('❌ No user ID found');
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

    console.log('🔍 DEBUG: User ID for payment:', user.id);
    console.log('🔍 DEBUG: Payment amount:', amount);

    if (apiStatus === 'offline') {
      alert("Backend API is offline. Please try again later.");
      return;
    }

    setLoading(true);
    try {
      console.log('🚀 Sending payment request to:', `${backendUrl}/api/payfast/create-payment`);
      console.log('📦 Request body:', { amount, userId: user.id });
      
      const res = await fetch(
        `${backendUrl}/api/payfast/create-payment`,
        {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Accept": "application/json",
            "ngrok-skip-browser-warning": "true"
          },
          body: JSON.stringify({
            amount: amount,
            userId: user.id
          }),
        }
      );

      console.log('📡 Response status:', res.status);
      console.log('📡 Response headers:', Object.fromEntries([...res.headers]));

      const contentType = res.headers.get('content-type');
      console.log('📡 Content-Type:', contentType);
      
      if (contentType?.includes('text/html')) {
        const html = await res.text();
        console.error('❌ Received HTML instead of JSON:', html.substring(0, 200));
        throw new Error('Server returned HTML page - API endpoint may be misconfigured');
      }

      if (!res.ok) {
        const errorText = await res.text();
        console.error('❌ Error response:', errorText);
        throw new Error(`Payment failed: ${res.status} - ${errorText}`);
      }

      const data = await res.json();
      console.log('✅ Payment response:', data);
      
      if (data.url) {
        console.log('🔄 Redirecting to PayFast:', data.url);
        
        sessionStorage.setItem('pendingPayment', JSON.stringify({
          amount: amount,
          timestamp: new Date().toISOString()
        }));
        
        window.location.href = data.url;
      } else {
        console.error('❌ No URL in response:', data);
        alert('Payment initiation failed: No redirect URL received');
      }
    } catch (err) {
      console.error("🔥 Payment error:", err);
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

  // Show API status warning if offline
  if (apiStatus === 'offline') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Backend Unavailable</h2>
          <p className="text-gray-600 mb-4">
            Cannot connect to the backend API at <code className="bg-gray-100 px-2 py-1 rounded">{backendUrl}</code>
          </p>
          <p className="text-gray-600 mb-6">
            Please ensure the backend server is running and accessible.
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50">
      <nav className="bg-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-2xl font-bold text-gray-800">
              Face Recognition App
            </h1>
            <div className="flex items-center gap-4">
              {apiStatus === 'checking' && (
                <span className="text-sm text-yellow-600">Connecting...</span>
              )}
              {apiStatus === 'online' && (
                <span className="text-sm text-green-600">● Online</span>
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
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          <h2 className="text-3xl font-bold text-gray-800">
            Welcome, {user?.username || 'User'}! 👋
          </h2>
          <p className="text-gray-600 mt-2">
            User ID: <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">{user?.id}</span>
          </p>
        </div>

        {/* Dashboard Grid */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Balance Card */}
          <div className="bg-white rounded-xl shadow-lg p-6 text-center transform hover:scale-105 transition-all duration-300">
            <Wallet className="w-12 h-12 text-blue-600 mx-auto" />
            <div className="text-2xl font-bold text-blue-600 mt-3">
              Your Balance
            </div>
            <p className="text-3xl font-bold text-gray-800 mt-2">
              {formatCurrency(balance ?? 0)}
            </p>
            {lastPayment && (
              <p className="text-xs text-green-600 mt-1 animate-pulse">
                +{formatCurrency(lastPayment.amount)} added
              </p>
            )}
          </div>

          {/* Payment Card */}
          <div className="bg-white rounded-xl shadow-lg p-6 text-center transform hover:scale-105 transition-all duration-300">
            <CreditCard className="w-12 h-12 text-green-600 mx-auto" />
            <div className="text-2xl font-bold text-green-600 mt-3">
              Make a Deposit
            </div>
            
            <div className="mt-4">
              <div className="flex items-center justify-center gap-2 mb-3">
                <span className="text-2xl font-bold text-gray-700">R</span>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  min="5"
                  max="10000"
                  step="1"
                  className="w-32 text-center text-2xl font-bold px-4 py-2 border-2 border-green-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Amount"
                />
              </div>
              
              {/* Quick amount buttons - Starting from R5 */}
              <div className="grid grid-cols-4 gap-2 mb-2">
                {[5, 10, 15, 20].map((preset) => (
                  <button
                    key={preset}
                    onClick={() => handlePresetAmount(preset)}
                    className={`py-2 px-3 rounded-lg text-sm font-semibold transition-all ${
                      amount === preset 
                        ? 'bg-green-600 text-white' 
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
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    R {preset}
                  </button>
                ))}
              </div>
              
              {/* Amount validation message */}
              {amountError && (
                <p className="text-xs text-red-500 mb-2">{amountError}</p>
              )}
              
              <p className="text-xs text-gray-500">Min: R5 | Max: R10,000</p>
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
          <div className="bg-white rounded-xl shadow-lg p-6 text-center transform hover:scale-105 transition-all duration-300">
            <Users className="w-12 h-12 text-orange-600 mx-auto" />
            <div className="text-2xl font-bold text-orange-600 mt-3">
              Community Balance
            </div>
            <p className="text-4xl font-bold text-gray-800 mt-2">
              {formatCurrency(communityBalance)}
            </p>
            <p className="text-sm text-gray-600 mt-2">Total savings across all users</p>
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="mt-8 bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4">Recent Transactions</h3>
          <div className="space-y-3">
            {recentTransactions.length > 0 ? (
              recentTransactions.map((tx, index) => (
                <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-semibold">Deposit</p>
                    <p className="text-sm text-gray-600">
                      {new Date(tx.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <p className="text-green-600 font-bold">+ {formatCurrency(tx.amount)}</p>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-center py-4">No transactions yet</p>
            )}
          </div>
        </div>

        {/* Debug Info Panel */}
        <div className="mt-8 p-4 bg-gray-100 rounded-lg border border-gray-200">
          <h3 className="font-bold text-gray-700 mb-2">🔧 Debug Information:</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            <div>
              <span className="font-semibold">Backend URL:</span>{' '}
              <code className="bg-white px-2 py-1 rounded">{backendUrl}</code>
            </div>
            <div>
              <span className="font-semibold">API Status:</span>{' '}
              <span className={apiStatus === 'online' ? 'text-green-600' : 'text-red-600'}>
                {apiStatus}
              </span>
            </div>
            <div>
              <span className="font-semibold">User ID:</span>{' '}
              <code className="bg-white px-2 py-1 rounded">{user?.id || 'Not logged in'}</code>
            </div>
            <div>
              <span className="font-semibold">Username:</span>{' '}
              <span>{user?.username || 'N/A'}</span>
            </div>
            <div>
              <span className="font-semibold">Your Balance:</span>{' '}
              <span className="font-bold text-green-600">{formatCurrency(balance ?? 0)}</span>
            </div>
            <div>
              <span className="font-semibold">Community Total:</span>{' '}
              <span className="font-bold text-orange-600">{formatCurrency(communityBalance)}</span>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => {
                fetchUserBalance();
                fetchCommunityBalance();
                fetchRecentTransactions();
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
            >
              🔄 Refresh Balances
            </button>
            <button
              onClick={() => {
                console.log('📊 Manual debug - Current user:', user);
                console.log('📊 Manual debug - Backend URL:', backendUrl);
                checkApiHealth();
              }}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg text-sm hover:bg-gray-700"
            >
              🔧 Debug
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}