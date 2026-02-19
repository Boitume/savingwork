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
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    // Check for existing session
    checkUser();
    
    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔐 Auth state changed:', event, session?.user?.email);
      
      if (event === 'SIGNED_IN' && session?.user) {
        console.log('✅ User signed in, handling session...');
        await handleUserSession(session.user);
      } else if (event === 'SIGNED_OUT') {
        console.log('👋 User signed out');
        setUser(null);
        setLoading(false);
      } else if (event === 'TOKEN_REFRESHED') {
        console.log('🔄 Token refreshed for:', session?.user?.email);
        if (session?.user) {
          await fetchUserProfile(session.user.id);
        }
      } else if (event === 'USER_UPDATED') {
        console.log('📝 User updated:', session?.user?.email);
        if (session?.user) {
          await fetchUserProfile(session.user.id);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [retryCount]);

  const checkUser = async () => {
    try {
      console.log('🔍 Checking for existing session...');
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('❌ Error getting session:', error);
        setLoading(false);
        return;
      }
      
      console.log('📦 Existing session:', session?.user?.email || 'No session');
      
      if (session?.user) {
        await fetchUserProfile(session.user.id);
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error('❌ Error checking user session:', error);
      setLoading(false);
    }
  };

  const fetchUserProfile = async (userId: string, isRetry = false) => {
    try {
      console.log(`🔍 Fetching user profile for: ${userId} ${isRetry ? '(retry)' : ''}`);
      
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      console.log('📦 Query result:', { data, error });

      if (error) {
        console.error('❌ Error fetching user profile:', error);
        
        // If it's a permission error, try a different approach
        if (error.code === '42501' || error.message.includes('permission denied')) {
          console.log('🔄 Permission error detected, attempting direct insert without select...');
          const session = await supabase.auth.getSession();
          if (session.data.session?.user) {
            await createUserFromAuth(session.data.session.user, true);
          }
        } 
        // If user not found, create them
        else if (error.code === 'PGRST116') {
          console.log('🔄 User not found in database, creating...');
          const session = await supabase.auth.getSession();
          if (session.data.session?.user) {
            await createUserFromAuth(session.data.session.user);
          } else {
            setLoading(false);
          }
        } else {
          setLoading(false);
        }
      } else if (data) {
        console.log('✅ User profile found:', data);
        setUser(data);
        setLoading(false);
        setRetryCount(0); // Reset retry count on success
      } else {
        // No data returned, user doesn't exist
        console.log('🔄 No user profile found, creating...');
        const session = await supabase.auth.getSession();
        if (session.data.session?.user) {
          await createUserFromAuth(session.data.session.user);
        } else {
          setLoading(false);
        }
      }
    } catch (error) {
      console.error('❌ Error in fetchUserProfile:', error);
      
      // Retry logic for transient errors
      if (retryCount < 3) {
        console.log(`🔄 Retrying fetch (${retryCount + 1}/3)...`);
        setRetryCount(prev => prev + 1);
        setTimeout(() => fetchUserProfile(userId, true), 1000 * (retryCount + 1));
      } else {
        setLoading(false);
        setRetryCount(0);
      }
    }
  };

  const createUserFromAuth = async (authUser: any, bypassSelect = false) => {
    try {
      console.log('🔄 Creating user from auth data:', authUser.email);
      console.log('📦 Auth user metadata:', authUser.user_metadata);
      
      const fullName = authUser.user_metadata?.full_name || '';
      const nameParts = fullName.split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      const username = authUser.email?.split('@')[0] || `user_${Date.now()}`;

      const newUser = {
        id: authUser.id,
        username: username,
        email: authUser.email,
        first_name: firstName,
        last_name: lastName,
        avatar_url: authUser.user_metadata?.avatar_url,
        provider: 'google',
        registered_at: new Date().toISOString(),
        balance: 0
      };

      console.log('📝 Attempting to insert user:', newUser);

      // Try insert with return data first
      if (!bypassSelect) {
        const { data, error } = await supabase
          .from('users')
          .insert([newUser])
          .select()
          .single();

        if (!error && data) {
          console.log('✅ User created successfully with select:', data);
          setUser(data);
          setLoading(false);
          return;
        } else {
          console.log('⚠️ Insert with select failed:', error);
        }
      }

      // Fallback: Insert without select
      console.log('🔄 Trying insert without select...');
      const { error: insertError } = await supabase
        .from('users')
        .insert([newUser]);

      if (insertError) {
        console.error('❌ Insert without select also failed:', insertError);
        
        // Try upsert as last resort
        console.log('🔄 Trying upsert as last resort...');
        const { error: upsertError } = await supabase
          .from('users')
          .upsert([newUser], { onConflict: 'id' });

        if (upsertError) {
          console.error('❌ Upsert also failed:', upsertError);
          
          // One more try - maybe the user already exists but we can't select it
          console.log('🔄 Checking if user exists despite errors...');
          const { data: existingUser, error: fetchError } = await supabase
            .from('users')
            .select('*')
            .eq('id', authUser.id)
            .maybeSingle();

          if (!fetchError && existingUser) {
            console.log('✅ User already exists:', existingUser);
            setUser(existingUser);
          } else {
            console.error('❌ Could not retrieve or create user');
          }
        } else {
          console.log('✅ Upsert successful');
          // Try to fetch the user we just upserted
          const { data: newData, error: fetchError } = await supabase
            .from('users')
            .select('*')
            .eq('id', authUser.id)
            .single();
          
          if (!fetchError && newData) {
            setUser(newData);
          }
        }
      } else {
        console.log('✅ Insert without select succeeded');
        // Fetch the user we just inserted
        const { data: newData, error: fetchError } = await supabase
          .from('users')
          .select('*')
          .eq('id', authUser.id)
          .single();
        
        if (!fetchError && newData) {
          setUser(newData);
        }
      }
    } catch (error) {
      console.error('❌ Error in createUserFromAuth:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUserSession = async (authUser: any) => {
    console.log('🔄 Handling user session for:', authUser.email);
    await fetchUserProfile(authUser.id);
  };

  const login = (userData: User) => {
    console.log('🔑 Manual login:', userData.username);
    setUser(userData);
  };

  const logout = async () => {
    try {
      console.log('👋 Logging out...');
      await supabase.auth.signOut();
      setUser(null);
    } catch (error) {
      console.error('❌ Error logging out:', error);
    }
  };

  const signInWithGoogle = async () => {
    try {
      console.log('🔐 Initiating Google Sign-In...');
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
      console.error('❌ Error signing in with Google:', error);
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