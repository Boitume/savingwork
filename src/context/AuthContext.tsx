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
    
    const initialize = async () => {
      try {
        console.log('🔍 Initializing auth...');
        
        // Get session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Session error:', error);
        }
        
        if (session?.user && mounted) {
          console.log('✅ Session found for:', session.user.email);
          await fetchUser(session.user.id, mounted);
        } else {
          console.log('ℹ️ No session found');
          if (mounted) setLoading(false);
        }
      } catch (error) {
        console.error('❌ Initialization error:', error);
        if (mounted) setLoading(false);
      } finally {
        if (mounted) setInitialized(true);
      }
    };

    initialize();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔐 Auth event:', event, session?.user?.email);
        
        if (!mounted) return;

        if (event === 'SIGNED_IN' && session?.user) {
          await fetchUser(session.user.id, mounted);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const fetchUser = async (userId: string, mounted: boolean) => {
    try {
      console.log('👤 Fetching user profile for:', userId);
      
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching user:', error);
        if (mounted) setLoading(false);
        return;
      }

      if (data && mounted) {
        console.log('✅ User found:', data);
        setUser(data);
      } else if (mounted) {
        console.log('ℹ️ User not found in database');
        // User authenticated but not in users table - create them
        await createUser(sessionStorage.getItem('pendingAuthUser'), mounted);
      }
      
      if (mounted) setLoading(false);
    } catch (error) {
      console.error('Error in fetchUser:', error);
      if (mounted) setLoading(false);
    }
  };

  const createUser = async (authUserJson: string | null, mounted: boolean) => {
    try {
      if (!authUserJson) {
        const { data } = await supabase.auth.getSession();
        if (!data.session?.user) {
          if (mounted) setLoading(false);
          return;
        }
        authUserJson = JSON.stringify(data.session.user);
      }

      const authUser = JSON.parse(authUserJson);
      console.log('🔄 Creating user from auth:', authUser.email);

      const newUser = {
        id: authUser.id,
        username: authUser.email?.split('@')[0] || `user_${Date.now()}`,
        email: authUser.email,
        provider: 'google',
        balance: 0
      };

      const { error } = await supabase
        .from('users')
        .insert([newUser]);

      if (error) {
        console.error('Error creating user:', error);
        if (mounted) setLoading(false);
        return;
      }

      // Fetch the newly created user
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (data && mounted) {
        setUser(data);
      }
      
      if (mounted) setLoading(false);
    } catch (error) {
      console.error('Error in createUser:', error);
      if (mounted) setLoading(false);
    }
  };

  const login = (userData: User) => {
    setUser(userData);
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const signInWithGoogle = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        }
      });
      if (error) throw error;
    } catch (error) {
      console.error('Google sign-in error:', error);
      setLoading(false);
    }
  };

  // Show loading only until initialized
  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading application...</p>
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