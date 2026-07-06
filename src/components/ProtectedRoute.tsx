import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

// Rota "casa" de cada papel — sempre um destino que aquele papel PODE acessar,
// para que um redirect por falta de permissão nunca entre em loop.
export function roleHome(perfil?: string): string {
  switch (perfil) {
    case 'aluno':       return '/portal';
    case 'vendedor':    return '/pipeline';
    case 'operacional': return '/gestao-operacional';
    default:            return '/dashboard'; // admin, gestor
  }
}

function Spinner() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export function ProtectedRoute({ children, roles }: { children: ReactNode; roles?: string[] }) {
  const { user, profile, loading } = useAuth();

  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;

  // Autorização por papel (defesa em profundidade — o RLS no backend é o gate real).
  // Esconder o link no menu não bastava: qualquer logado navegava direto pela URL.
  if (roles && roles.length > 0) {
    if (!profile) return <Spinner />;            // aguarda o perfil carregar
    if (!roles.includes(profile.perfil)) {
      return <Navigate to={roleHome(profile.perfil)} replace />;
    }
  }

  return <>{children}</>;
}
