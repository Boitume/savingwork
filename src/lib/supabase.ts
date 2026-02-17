import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface User {
  id: string;
  username: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  provider?: 'face' | 'google';
  face_descriptor?: number[];
  balance?: number;
  created_at?: string;
  registered_at?: string;
  last_login_at?: string;
}