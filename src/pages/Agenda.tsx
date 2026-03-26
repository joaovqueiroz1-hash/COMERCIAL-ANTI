import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { fetchProximasAcoes, fetchLeads, fetchProfiles, updateProximaAcao } from '@/lib/api';
import { Calendar, Clock, CheckCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';

export default function Agenda() {
  const now = new Date();
  const queryClient = useQueryClient();
  const { data: acoes = [], isLoading } = useQuery({ queryKey: ['proximas_acoes'], queryFn: () => fetchProximasAcoes() });
  const { data: leads = [] } = useQuery({ queryKey: ['leads'], queryFn: fetchLeads });
  const { data: profiles = [] } = useQuery({ queryKey: ['profiles'], queryFn: fetchProfiles });

  const concluirMutation = useMutation({
    mutationFn: (id: string) => updateProximaAcao(id, { concluida: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proximas_acoes'] });
      toast({ title: 'Ação concluída ✓' });
    },
  });

  const pendentes = acoes.filter((a) => !a.concluida).sort((a, b) => new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime());

  const tipoColors: Record<string, string> = { reuniao: 'bg-primary/20 text-primary', whatsapp: 'bg-success/20 text-success', ligacao: 'bg-info/20 text-info', email: 'bg-warning/20 text-warning' };

  if (isLoading) return <AppLayout title="Agenda"><Skeleton className="h-40 card-premium" /></AppLayout>;

  return (
    <AppLayout title="Agenda" subtitle="Próximas ações e reuniões">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="card-premium p-4 border-l-2 border-l-primary">
          <div className="flex items-center gap-3">
            <Calendar size={18} className="text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Hoje — {now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
          </div>
        </div>
        {pendentes.length > 0 ? pendentes.map((acao) => {
          const lead = leads.find((l) => l.id === acao.lead_id);
          const resp = profiles.find((u) => u.id === acao.responsavel_id);
          const date = new Date(acao.data_hora);
          const isOverdue = date < now;
          return (
            <div key={acao.id} className={`card-premium p-4 ${isOverdue ? 'border-l-2 border-l-destructive' : ''}`}>
              <div className="flex items-start gap-4">
                <div className="text-center shrink-0">
                  <p className="text-lg font-bold text-foreground">{date.getDate()}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">{date.toLocaleDateString('pt-BR', { month: 'short' })}</p>
                  <p className="text-xs text-primary font-medium">{date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-medium text-foreground">{acao.titulo}</h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${tipoColors[acao.tipo || ''] || 'bg-muted text-muted-foreground'}`}>{acao.tipo}</span>
                    {isOverdue && <span className="text-[10px] px-2 py-0.5 rounded-full bg-destructive/20 text-destructive">Atrasada</span>}
                  </div>
                  <p className="text-xs text-muted-foreground mb-1">{acao.descricao}</p>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span>Lead: {lead?.nome_completo || '—'}</span><span>•</span><span>Resp: {resp?.nome?.split(' ')[0] || '—'}</span>
                  </div>
                </div>
                <button
                  onClick={() => concluirMutation.mutate(acao.id)}
                  disabled={concluirMutation.isPending}
                  className="text-muted-foreground hover:text-success transition-colors shrink-0"
                >
                  <CheckCircle size={20} />
                </button>
              </div>
            </div>
          );
        }) : (
          <div className="card-premium p-8 text-center"><Clock size={32} className="mx-auto text-muted-foreground mb-3" /><p className="text-sm text-muted-foreground">Nenhuma ação pendente</p></div>
        )}
      </div>
    </AppLayout>
  );
}
