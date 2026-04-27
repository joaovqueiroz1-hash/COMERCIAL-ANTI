import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import lvLogo from '@/assets/Logo-LV-Branco.png';

export default function Login() {
  const { user, profile, loading, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Mostra spinner enquanto o AuthContext resolve a sessão salva
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Já autenticado e com perfil — deixa o RootRedirect redirecionar para a rota correta
  if (user && profile) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await signIn(email, password);
    if (error) {
      toast({ title: 'Erro ao entrar', description: error.message, variant: 'destructive' });
      setSubmitting(false);
    }
    // Sem navigate(): quando signIn tiver sucesso, onAuthStateChange atualiza
    // o user, re-renderiza este componente, e o "if (user)" acima redireciona.
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src={lvLogo} alt="LV Business Club" className="h-20 mx-auto mb-6" />
          <h1 className="text-2xl font-semibold text-foreground mb-2">Bem-vindo de volta</h1>
          <p className="text-sm text-muted-foreground">Acesse o painel de gestão de leads</p>
        </div>

        <form onSubmit={handleSubmit} className="card-premium p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">E-mail</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              className="bg-bg-tertiary border-border h-11"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Senha</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="bg-bg-tertiary border-border h-11"
              minLength={6}
              required
            />
          </div>
          <Button
            type="submit"
            disabled={submitting}
            className="w-full h-11 gold-gradient text-primary-foreground font-semibold hover:opacity-90 transition-opacity"
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Entrando...
              </span>
            ) : 'Entrar'}
          </Button>
        </form>
      </div>
    </div>
  );
}
