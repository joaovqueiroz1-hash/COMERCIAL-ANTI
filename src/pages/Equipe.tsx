import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { fetchProfiles, fetchLeads } from '@/lib/api';
import { getInitials } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { UserPlus, ToggleLeft, ToggleRight, Loader2, Trash2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export default function Equipe() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const { data: profiles = [], isLoading } = useQuery({ queryKey: ['profiles'], queryFn: fetchProfiles });
  const { data: leads = [] } = useQuery({ queryKey: ['leads'], queryFn: fetchLeads });
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [perfil, setPerfil] = useState<'vendedor' | 'gestor' | 'admin'>('vendedor');
  const [creating, setCreating] = useState(false);

  const isAdmin = profile?.perfil === 'admin';
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('profiles').delete().eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      setDeleteConfirmId(null);
      toast({ title: 'Usuário removido da equipe.' });
    },
    onError: (err: Error) => {
      toast({ title: 'Erro ao remover usuário', description: err.message, variant: 'destructive' });
    },
  });

  const perfilLabels: Record<string, string> = { admin: 'Admin Master', gestor: 'Gestora Comercial', vendedor: 'Vendedor(a)' };
  const perfilColors: Record<string, string> = { admin: 'bg-primary/20 text-primary', gestor: 'bg-info/20 text-info', vendedor: 'bg-success/20 text-success' };

  const toggleAtivoMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from('profiles').update({ ativo }).eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
    },
    onError: (err: Error) => {
      toast({ title: 'Erro ao atualizar status', description: err.message, variant: 'destructive' });
    },
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({ title: 'Senha muito curta', description: 'Mínimo de 6 caracteres.', variant: 'destructive' });
      return;
    }
    setCreating(true);
    try {
      // Try Edge Function first (admin API — requires function deployed in Supabase)
      const res = await supabase.functions.invoke('create-user', {
        body: { email, password, nome, perfil },
      });

      const fnError = res.error || res.data?.error;

      if (!fnError) {
        // Edge Function succeeded
        toast({ title: 'Usuário criado com sucesso!' });
        queryClient.invalidateQueries({ queryKey: ['profiles'] });
        setOpen(false);
        setNome(''); setEmail(''); setPassword(''); setPerfil('vendedor');
      } else {
        // Fallback: create via signUp (works without Edge Function)
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { nome, perfil } },
        });

        if (signUpError) throw new Error(signUpError.message);

        // Upsert profile manually in case trigger didn't fire
        if (signUpData.user) {
          await supabase.from('profiles').upsert({
            id: signUpData.user.id,
            nome,
            email,
            perfil,
            ativo: true,
          });
        }

        toast({ title: 'Usuário criado com sucesso!', description: 'Peça ao usuário para confirmar o e-mail se necessário.' });
        queryClient.invalidateQueries({ queryKey: ['profiles'] });
        setOpen(false);
        setNome(''); setEmail(''); setPassword(''); setPerfil('vendedor');
      }
    } catch (err: any) {
      toast({ title: 'Erro ao criar usuário', description: err.message, variant: 'destructive' });
    }
    setCreating(false);
  };

  if (isLoading) return (
    <AppLayout title="Equipe">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 card-premium" />)}
      </div>
    </AppLayout>
  );

  return (
    <AppLayout
      title="Equipe"
      subtitle="Gestão de usuários e times"
      actions={isAdmin ? (
        <Button onClick={() => setOpen(true)} className="gold-gradient text-primary-foreground font-semibold text-sm h-9 px-4">
          <UserPlus size={14} className="mr-2" /> Novo Usuário
        </Button>
      ) : undefined}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {profiles.map((user) => {
          const leadsCount = leads.filter((l) => l.vendedor_id === user.id || l.gestor_id === user.id).length;
          const fechados = leads.filter((l) => l.vendedor_id === user.id && ['fechado', 'vendido'].includes(l.status_pipeline)).length;
          const isToggling = toggleAtivoMutation.isPending && toggleAtivoMutation.variables?.id === user.id;

          return (
            <div key={user.id} className={`card-premium p-6 transition-opacity ${!user.ativo ? 'opacity-50' : ''}`}>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full gold-gradient flex items-center justify-center text-sm font-bold text-primary-foreground shrink-0">
                  {getInitials(user.nome)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-foreground">{user.nome}</h3>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full mt-1 ${perfilColors[user.perfil]}`}>
                    {perfilLabels[user.perfil]}
                  </span>
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => toggleAtivoMutation.mutate({ id: user.id, ativo: !user.ativo })}
                      disabled={isToggling}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-50"
                      title={user.ativo ? 'Desativar usuário' : 'Ativar usuário'}
                    >
                      {isToggling
                        ? <Loader2 size={20} className="animate-spin" />
                        : user.ativo
                          ? <ToggleRight size={20} className="text-success" />
                          : <ToggleLeft size={20} />
                      }
                    </button>
                    {deleteConfirmId === user.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => deleteUserMutation.mutate(user.id)}
                          disabled={deleteUserMutation.isPending}
                          className="text-[10px] px-2 py-0.5 rounded bg-destructive/20 text-destructive hover:bg-destructive/30 transition-colors"
                        >
                          {deleteUserMutation.isPending ? '...' : 'Confirmar'}
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="text-[10px] text-muted-foreground hover:text-foreground"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirmId(user.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                        title="Remover usuário"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-border">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Leads</p>
                  <p className="text-lg font-bold text-foreground">{leadsCount}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Fechados</p>
                  <p className="text-lg font-bold text-success">{fechados}</p>
                </div>
              </div>
            </div>
          );
        })}
        {profiles.length === 0 && (
          <div className="card-premium p-8 text-center md:col-span-3">
            <p className="text-sm text-muted-foreground">Nenhum membro na equipe. Crie uma conta para começar.</p>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Novo Usuário</DialogTitle>
            <DialogDescription>Preencha os dados para criar um novo membro da equipe.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Nome completo</Label>
              <Input
                value={nome}
                onChange={e => setNome(e.target.value)}
                placeholder="Nome do usuário"
                className="bg-bg-tertiary border-border mt-1"
                required
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">E-mail</Label>
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="email@exemplo.com"
                className="bg-bg-tertiary border-border mt-1"
                required
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Senha</Label>
              <Input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="bg-bg-tertiary border-border mt-1"
                minLength={6}
                required
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-3 block">Perfil de acesso</Label>
              <RadioGroup value={perfil} onValueChange={(v) => setPerfil(v as any)} className="flex gap-4">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="vendedor" id="r-vendedor" />
                  <Label htmlFor="r-vendedor" className="text-sm text-foreground cursor-pointer">Vendedor</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="gestor" id="r-gestor" />
                  <Label htmlFor="r-gestor" className="text-sm text-foreground cursor-pointer">Gestor</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="admin" id="r-admin" />
                  <Label htmlFor="r-admin" className="text-sm text-foreground cursor-pointer">Admin</Label>
                </div>
              </RadioGroup>
            </div>
            <Button type="submit" disabled={creating} className="w-full gold-gradient text-primary-foreground font-semibold">
              {creating ? <><Loader2 size={14} className="animate-spin mr-2" /> Criando...</> : 'Criar Usuário'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
