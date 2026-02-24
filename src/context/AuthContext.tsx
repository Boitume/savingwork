import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { supabase, User } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  login: (user: User) => void;
  logout: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    let mounted = true;
    let retryCount = 0;
    const maxRetries = 3;
    
    const initialize = async () => {
      try {
        console.log('🔍 Initializing auth...');
        
        // Get session with timeout protection
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Session fetch timeout')), 5000)
        );
        
        const { data: { session }, error } = await Promise.race([
          sessionPromise,
          timeoutPromise
        ]) as any;
        
        if (error) {
          console.error('❌ Session error:', error);
        }
        
        console.log('📦 Session check complete:', session ? '✅ Found' : '❌ None');
        
        if (session?.user && mounted) {
          console.log('✅ Session found for:', session.user.email);
          await fetchUser(session.user.id, mounted);
        } else {
          console.log('ℹ️ No session found, setting loading false');
          if (mounted) {
            setLoading(false);
            setInitialized(true);
          }
        }
      } catch (error) {
        console.error('❌ Initialization error:', error);
        
        // Retry logic for network issues
        if (retryCount < maxRetries && mounted) {
          retryCount++;
          console.log(`🔄 Retrying initialization (${retryCount}/${maxRetries})...`);
          setTimeout(initialize, 1000 * retryCount);
        } else {
          if (mounted) {
            setLoading(false);
            setInitialized(true);
          }
        }
      }
    };

    initialize();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔐 Auth event:', event, session?.user?.email);
        
        if (!mounted) return;

        if (event === 'SIGNED_IN' && session?.user) {
          console.log('🎉 User signed in, fetching profile...');
          setLoading(true);
          await fetchUser(session.user.id, mounted);
        } else if (event === 'SIGNED_OUT') {
          console.log('👋 User signed out');
          setUser(null);
          setLoading(false);
        } else if (event === 'TOKEN_REFRESHED') {
          console.log('🔄 Token refreshed');
        }
      }
    );

    return () => {
      console.log('🧹 Cleaning up auth subscription');
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const fetchUser = async (userId: string, mounted: boolean) => {
    try {
      console.log('👤 Fetching user profile for:', userId);
      
      // Try to get user from database
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('❌ Error fetching user:', error);
        if (mounted) {
          setLoading(false);
          setInitialized(true);
        }
        return;
      }

      if (data && mounted) {
        console.log('✅ User found in database:', data.username);
        setUser(data);
        setLoading(false);
        setInitialized(true);
      } else if (mounted) {
        console.log('ℹ️ User not found in database, creating profile...');
        // User authenticated but not in users table - create them
        await createUser(userId, mounted);
      }
    } catch (error) {
      console.error('❌ Error in fetchUser:', error);
      if (mounted) {
        setLoading(false);
        setInitialized(true);
      }
    }
  };

  const createUser = async (userId: string, mounted: boolean) => {
    try {
      // Get user from auth
      const { data: { user: authUser } } = await supabase.auth.getUser();
      
      if (!authUser && mounted) {
        console.error('❌ No auth user found');
        setLoading(false);
        setInitialized(true);
        return;
      }

      console.log('🔄 Creating user from auth:', authUser?.email);

      const newUser = {
        id: userId,
        username: authUser?.email?.split('@')[0] || `user_${Date.now()}`,
        email: authUser?.email,
        balance: 0,
        created_at: new Date().toISOString()
      };

      // Insert the user
      const { error: insertError } = await supabase
        .from('users')
        .insert([newUser]);

      if (insertError) {
        // Check if it's a duplicate key error (user already exists)
        if (insertError.code === '23505') { // PostgreSQL duplicate key violation
          console.log('ℹ️ User already exists, fetching...');
          const { data } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();
            
          if (data && mounted) {
            setUser(data);
          }
        } else {
          console.error('❌ Error creating user:', insertError);
        }
        
        if (mounted) {
          setLoading(false);
          setInitialized(true);
        }
        return;
      }

      // Fetch the newly created user
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (data && mounted) {
        console.log('✅ User created successfully:', data.username);
        setUser(data);
      }
      
      if (mounted) {
        setLoading(false);
        setInitialized(true);
      }
    } catch (error) {
      console.error('❌ Error in createUser:', error);
      if (mounted) {
        setLoading(false);
        setInitialized(true);
      }
    }
  };

  const login = (userData: User) => {
    console.log('🔐 Manual login:', userData.username);
    setUser(userData);
  };

  const logout = async () => {
    try {
      console.log('👋 Logging out...');
      await supabase.auth.signOut();
      setUser(null);
    } catch (error) {
      console.error('❌ Logout error:', error);
    }
  };

  const signInWithGoogle = async () => {
    try {
      console.log('🔐 Starting Google sign-in...');
      setLoading(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        }
      });
      if (error) throw error;
    } catch (error) {
      console.error('❌ Google sign-in error:', error);
      setLoading(false);
      setInitialized(true);
    }
  };

  // Show loading with timeout protection
  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-green-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-green-600 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300 text-lg">Loading application...</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">Please wait</p>
          <button 
            onClick={() => {
              setInitialized(true);
              setLoading(false);
            }}
            className="mt-4 text-xs text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 underline"
          >
            Skip if stuck
          </button>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, signInWithGoogle, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}