import { LogOut, User as UserIcon, Wallet, CreditCard, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useState, useEffect } from 'react';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState<number>(100);
  
  // Use Vite environment variables (automatically loaded from root .env)
  const backendUrl = import.meta.env.VITE_BACKEND_URL;

  useEffect(() => {
    console.log('🔧 Environment:', {
      backendUrl,
      supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
      mode: import.meta.env.MODE
    });
  }, []);

  const handlePayment = async () => {
    if (!user?.id) {
      alert("Please log in first");
      return;
    }

    setLoading(true);
    try {
      console.log('🚀 Using backend:', backendUrl);
      
      const res = await fetch(
        `${backendUrl}/payfast/create-payment`,
        {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "ngrok-skip-browser-warning": "true"
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
        window.location.href = data.url;
      }
    } catch (err) {
      console.error("🔥 Payment error:", err);
      alert(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50">
      <nav className="bg-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-2xl font-bold text-gray-800">
              Face Recognition App
            </h1>
            <button
              onClick={logout}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg"
            >
              <LogOut className="w-5 h-5" /> Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Welcome Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          <h2 className="text-3xl font-bold text-gray-800">
            Welcome, {user?.username}! 👋
          </h2>
        </div>

        {/* Dashboard Grid */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Payment Card */}
          <div className="bg-white rounded-xl shadow-lg p-6 text-center">
            <CreditCard className="w-12 h-12 text-green-600 mx-auto" />
            <div className="text-2xl font-bold text-green-600 mt-3">
              Make a Deposit
            </div>
            
            <div className="mt-4">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                min="10"
                className="w-full px-4 py-2 border rounded-lg"
                placeholder="Enter amount"
              />
            </div>

            <button
              onClick={handlePayment}
              disabled={loading}
              className={`mt-4 w-full py-3 px-4 rounded-lg text-white font-semibold ${
                loading ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              {loading ? 'Processing...' : `Pay R ${amount}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}