import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

interface Profile {
  id: string;
  nome: string;
  email: string;
  perfil: 'admin' | 'gestor' | 'vendedor' | 'aluno' | 'operacional';
  ativo: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, nome: string, perfil?: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function fetchProfile(userId: string): Promise<Profile | null> {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();
        if (error) throw error;
        return data as Profile;
      } catch (err) {
        console.error('fetchProfile falhou:', err);
        return null;
      }
    }

    // Resolve the initial session once — this is the source of truth on page load.
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;

      if (session?.user) {
        const p = await fetchProfile(session.user.id);
        if (mounted) {
          if (p) {
            setProfile(p);
            setSession(session);
            setUser(session.user);
          } else {
            // Profile not found — sign out silently so auth state is clean.
            await supabase.auth.signOut();
            setProfile(null);
            setSession(null);
            setUser(null);
          }
        }
      } else {
        if (mounted) {
          setProfile(null);
          setSession(null);
          setUser(null);
        }
      }

      if (mounted) {
        setLoading(false);
      }
    });

    // Only reacts to auth changes AFTER the initial session is resolved:
    // SIGNED_IN (user just logged in), SIGNED_OUT, TOKEN_REFRESHED.
    // We skip INITIAL_SESSION because getSession() above already handles it.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        // Skip the duplicate INITIAL_SESSION — getSession handles it.
        if (event === 'INITIAL_SESSION') return;

        if (session?.user) {
          // Don't block UI for token refresh — profile didn't change.
          if (event === 'TOKEN_REFRESHED') {
            if (mounted) setSession(session);
            return;
          }

          // For SIGNED_IN: fetch profile and update state.
          const p = await fetchProfile(session.user.id);
          if (!mounted) return;

          if (p) {
            setProfile(p);
            setSession(session);
            setUser(session.user);
          } else {
            await supabase.auth.signOut();
            setProfile(null);
            setSession(null);
            setUser(null);
          }
        } else {
          if (mounted) {
            setProfile(null);
            setSession(null);
            setUser(null);
          }
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string, nome: string, perfil = 'vendedor') => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { nome, perfil } },
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
