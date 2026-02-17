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

  useEffect(() => {
    // Check for existing session
    checkUser();
    
    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session?.user?.email);
      
      if (event === 'SIGNED_IN' && session?.user) {
        await handleUserSession(session.user);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setLoading(false);
      } else if (event === 'TOKEN_REFRESHED') {
        // Session was refreshed, fetch user data again
        if (session?.user) {
          await fetchUserProfile(session.user.id);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      console.log('Existing session:', session?.user?.email);
      
      if (session?.user) {
        await fetchUserProfile(session.user.id);
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error('Error checking user session:', error);
      setLoading(false);
    }
  };

  const fetchUserProfile = async (userId: string) => {
    try {
      console.log('Fetching user profile for:', userId);
      
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching user profile:', error);
        // If user not found in our table, try to create it
        if (error.code === 'PGRST116') {
          const session = await supabase.auth.getSession();
          if (session.data.session?.user) {
            await createUserFromAuth(session.data.session.user);
          }
        }
      } else {
        console.log('User profile found:', data);
        setUser(data);
      }
    } catch (error) {
      console.error('Error in fetchUserProfile:', error);
    } finally {
      setLoading(false);
    }
  };

  const createUserFromAuth = async (authUser: any) => {
    try {
      console.log('Creating user from auth data:', authUser.email);
      
      const fullName = authUser.user_metadata?.full_name || '';
      const nameParts = fullName.split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      const newUser = {
        id: authUser.id,
        username: authUser.email?.split('@')[0] || `user_${Date.now()}`,
        email: authUser.email,
        first_name: firstName,
        last_name: lastName,
        avatar_url: authUser.user_metadata?.avatar_url,
        provider: 'google',
        registered_at: new Date().toISOString(),
        balance: 0
      };

      console.log('Inserting new user:', newUser);

      const { data, error } = await supabase
        .from('users')
        .insert([newUser])
        .select()
        .single();

      if (error) {
        console.error('Error creating user:', error);
      } else {
        console.log('User created successfully:', data);
        setUser(data);
      }
    } catch (error) {
      console.error('Error in createUserFromAuth:', error);
    }
  };

  const handleUserSession = async (authUser: any) => {
    console.log('Handling user session for:', authUser.email);
    await fetchUserProfile(authUser.id);
  };

  const login = (userData: User) => {
    setUser(userData);
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const signInWithGoogle = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          }
        }
      });
      if (error) throw error;
    } catch (error) {
      console.error('Error signing in with Google:', error);
      setLoading(false);
      throw error;
    }
  };

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