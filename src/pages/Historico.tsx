import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { fetchAllPipelineLogs, fetchProfiles } from '@/lib/api';
import { STATUS_LABELS, PipelineStatus } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronRight, Activity } from 'lucide-react';

export default function Historico() {
  const [userFilter, setUserFilter] = useState('all');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [busca, setBusca] = useState('');

  const { data: logs = [], isLoading } = useQuery({ queryKey: ['pipeline_logs_all'], queryFn: () => fetchAllPipelineLogs(500) });
  const { data: profiles = [] } = useQuery({ queryKey: ['profiles'], queryFn: fetchProfiles });

  const filtered = useMemo(() => {
    let result = logs;
    if (userFilter !== 'all') result = result.filter((l: any) => l.alterado_por === userFilter);
    if (dataInicio) result = result.filter((l: any) => new Date(l.alterado_em) >= new Date(dataInicio));
    if (dataFim) result = result.filter((l: any) => new Date(l.alterado_em) <= new Date(dataFim + 'T23:59:59'));
    if (busca.trim()) {
      const s = busca.toLowerCase();
      result = result.filter((l: any) => (l.leads?.nome_completo || '').toLowerCase().includes(s) || (l.profiles?.nome || '').toLowerCase().includes(s));
    }
    return result;
  }, [logs, userFilter, dataInicio, dataFim, busca]);

  const statusLabel = (s: string) => STATUS_LABELS[s as PipelineStatus] || s;

  const statusPill = (s: string) => {
    const fechado = s === 'fechado';
    const perdido = s === 'perdido';
    const congelado = s === 'congelado';
    return (
      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
        fechado ? 'bg-primary/20 text-primary' :
        perdido ? 'bg-secondary/60 text-muted-foreground/60' :
        congelado ? 'bg-secondary/50 text-muted-foreground/50' :
        'bg-secondary text-muted-foreground'
      }`}>
        {statusLabel(s)}
      </span>
    );
  };

  if (isLoading) {
    return (
      <AppLayout title="Histórico">
        <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Histórico" subtitle={`${filtered.length} movimentações`}>
      {/* Filters */}
      <div className="card-premium p-3 mb-4 flex flex-wrap gap-2 items-center">
        <Input
          placeholder="Buscar lead ou usuário..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          className="h-9 bg-secondary border-border text-sm w-52"
        />
        <Select value={userFilter} onValueChange={setUserFilter}>
          <SelectTrigger className="h-9 bg-secondary border-border text-sm w-44">
            <SelectValue placeholder="Todos os usuários" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os usuários</SelectItem>
            {profiles.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="h-9 bg-secondary border-border text-sm w-40" placeholder="De" />
        <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="h-9 bg-secondary border-border text-sm w-40" placeholder="Até" />
      </div>

      {/* Desktop table */}
      <div className="card-premium overflow-hidden hidden md:block">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="p-3 text-left text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Data / Hora</th>
              <th className="p-3 text-left text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Lead</th>
              <th className="p-3 text-left text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Movimentação</th>
              <th className="p-3 text-left text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Usuário</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={4} className="p-8 text-center text-sm text-muted-foreground">Nenhuma movimentação encontrada.</td></tr>
            )}
            {filtered.map((log: any) => (
              <tr key={log.id} className="border-b border-border/40 hover:bg-secondary/30 transition-colors">
                <td className="p-3">
                  <p className="text-xs text-foreground font-medium">{new Date(log.alterado_em).toLocaleDateString('pt-BR')}</p>
                  <p className="text-[10px] text-muted-foreground">{new Date(log.alterado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                </td>
                <td className="p-3">
                  <p className="text-sm text-foreground font-medium truncate max-w-[200px]">{log.leads?.nome_completo || '—'}</p>
                  <p className="text-[10px] text-muted-foreground truncate max-w-[200px]">{log.leads?.nome_empresa || ''}</p>
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    {log.status_anterior && statusPill(log.status_anterior)}
                    {log.status_anterior && <ChevronRight size={12} className="text-muted-foreground/40 shrink-0" />}
                    {statusPill(log.status_novo)}
                  </div>
                </td>
                <td className="p-3">
                  <p className="text-xs text-foreground">{log.profiles?.nome || '—'}</p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-2 md:hidden">
        {filtered.length === 0 && <div className="card-premium p-8 text-center text-sm text-muted-foreground">Nenhuma movimentação encontrada.</div>}
        {filtered.map((log: any) => (
          <div key={log.id} className="card-premium p-3 animate-fade-in">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{log.leads?.nome_completo || '—'}</p>
                <p className="text-[10px] text-muted-foreground">{new Date(log.alterado_em).toLocaleString('pt-BR')}</p>
              </div>
              <p className="text-[10px] text-muted-foreground shrink-0">{log.profiles?.nome || '—'}</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Activity size={11} className="text-muted-foreground shrink-0" />
              {log.status_anterior && statusPill(log.status_anterior)}
              {log.status_anterior && <ChevronRight size={12} className="text-muted-foreground/40 shrink-0" />}
              {statusPill(log.status_novo)}
            </div>
          </div>
        ))}
      </div>
    </AppLayout>
  );
}
