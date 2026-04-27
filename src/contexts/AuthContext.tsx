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

// Busca o perfil do usuário — fora do componente para evitar recriações
async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) {
    console.error('[Auth] fetchProfile erro:', error.message, error.code);
    return null;
  }
  return data as Profile;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Resolve a sessão salva no localStorage — única fonte de verdade na inicialização
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
            // Sessão existe mas perfil não → limpa estado corrompido
            await supabase.auth.signOut();
            setProfile(null);
            setSession(null);
            setUser(null);
          }
        }
      }

      if (mounted) setLoading(false);
    });

    // Listener apenas para: refresh de token e logout
    // SIGNED_IN é tratado diretamente em signIn() para garantir propagação de erros
    // INITIAL_SESSION é ignorado pois getSession() já tratou
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') return;

      if (event === 'TOKEN_REFRESHED' && session) {
        setSession(session);
        return;
      }

      // SIGNED_OUT ou sessão expirada
      if (!session && mounted) {
        setProfile(null);
        setSession(null);
        setUser(null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // signIn trata o perfil diretamente e retorna erro visível ao componente chamador
  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error };

    if (data?.user) {
      const p = await fetchProfile(data.user.id);
      if (!p) {
        // Perfil ausente: faz logout limpo e devolve erro descritivo
        await supabase.auth.signOut();
        return {
          error: {
            message: 'Perfil não encontrado para este usuário. Contate o administrador.',
          },
        };
      }
      setProfile(p);
      setSession(data.session);
      setUser(data.user);
    }

    return { error: null };
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
    setSession(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
