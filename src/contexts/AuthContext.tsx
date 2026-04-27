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

    async function fetchProfile(userId: string, retries = 3): Promise<boolean> {
      for (let i = 0; i < retries; i++) {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
            
          if (error) throw error;

          if (mounted && data) {
            setProfile(data as Profile);
            return true;
          }
        } catch (err) {
          console.error(`Tentativa ${i + 1} de buscar perfil falhou:`, err);
          if (i < retries - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }
      return false;
    }

    // Resolve a sessão inicial antes de qualquer render protegido
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      
      if (session?.user) {
        const hasProfile = await fetchProfile(session.user.id);
        if (hasProfile) {
          setSession(session);
          setUser(session.user);
        } else {
          // Segurança anti-loop: deslogar se o perfil não existe ou falhou
          await supabase.auth.signOut();
          setProfile(null);
          setSession(null);
          setUser(null);
        }
      } else {
        setSession(null);
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    // Escuta mudanças de auth (login, logout, refresh de token)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        
        // Bloqueia a UI para evitar reders prematuros com user mas sem profile
        setLoading(true);
        
        if (session?.user) {
          const hasProfile = await fetchProfile(session.user.id);
          if (hasProfile) {
            setSession(session);
            setUser(session.user);
          } else {
            // Segurança anti-loop
            await supabase.auth.signOut();
            setProfile(null);
            setSession(null);
            setUser(null);
          }
        } else {
          setProfile(null);
          setSession(null);
          setUser(null);
        }
        
        setLoading(false);
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
