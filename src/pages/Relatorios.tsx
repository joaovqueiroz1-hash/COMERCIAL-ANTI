import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { fetchLeads, fetchProfiles } from '@/lib/api';
import { formatCurrency } from '@/lib/types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, Legend } from 'recharts';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function Relatorios() {
  const GOLD = 'hsl(46,65%,52%)';
  const LIGHT = 'hsl(0,0%,70%)';
  const GRAY = 'hsl(0,0%,50%)';
  const GREEN = 'hsl(142,69%,58%)';
  const BLUE = 'hsl(213,94%,68%)';
  const ORANGE = 'hsl(27,96%,61%)';

  const tooltipStyle = {
    background: 'hsl(0,0%,8%)',
    border: '1px solid hsl(0,0%,16%)',
    borderRadius: 8,
    color: 'hsl(0,0%,94%)',
    fontSize: 12,
  };

  const { data: leads = [], isLoading } = useQuery({ queryKey: ['leads'], queryFn: fetchLeads });
  const { data: profiles = [] } = useQuery({ queryKey: ['profiles'], queryFn: fetchProfiles });

  if (isLoading) return (
    <AppLayout title="Relatórios">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-60 card-premium" />)}
      </div>
    </AppLayout>
  );

  const isVendido = (s: string) => s === 'fechado' || s === 'vendido';
  const fechados = leads.filter((l) => isVendido(l.status_pipeline));
  const ativos = leads.filter((l) => !isVendido(l.status_pipeline) && l.status_pipeline !== 'perdido');
  const potencialTotal = ativos.reduce((s, l) => s + (l.faturamento_anual || 0), 0);
  const receitaFechada = fechados.reduce((s, l) => s + (l.faturamento_anual || 0), 0);
  const ticketMedio = fechados.length > 0 ? receitaFechada / fechados.length : 0;

  const vendedorData = profiles.filter((u) => u.perfil === 'vendedor' && u.ativo).map((u) => {
    const total = leads.filter((l) => l.vendedor_id === u.id).length;
    const closed = leads.filter((l) => l.vendedor_id === u.id && isVendido(l.status_pipeline)).length;
    return { name: u.nome.split(' ')[0], taxa: total > 0 ? Math.round((closed / total) * 100) : 0 };
  });

  const faixas = [
    { label: 'Até 100k', min: 0, max: 100000 },
    { label: '100k-500k', min: 100000, max: 500000 },
    { label: '500k-1M', min: 500000, max: 1000000 },
    { label: '1M-5M', min: 1000000, max: 5000000 },
    { label: '5M+', min: 5000000, max: Infinity },
  ];
  const faturamentoData = faixas.map((f) => ({
    name: f.label,
    value: leads.filter((l) => (l.faturamento_anual || 0) >= f.min && (l.faturamento_anual || 0) < f.max).length,
  }));

  const dores = leads.reduce((acc, l) => {
    if (!l.maior_dor) return acc;
    const raw = l.maior_dor.trim();
    const d = raw.length > 25 ? raw.substring(0, 25).replace(/\s\S*$/, '') + '…' : raw;
    acc[d] = (acc[d] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const doresData = Object.entries(dores).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, value]) => ({ name, value }));

  const empresarios = leads.filter((l) => l.eh_empresario).length;
  const perfilData = [
    { name: 'Empresário', value: empresarios },
    { name: 'Não empresário', value: leads.length - empresarios },
  ];

  const pipelineEvolution = ['Jan', 'Fev', 'Mar'].map((m, i) => ({
    name: m,
    novos: 15 + i * 5,
    contato: 10 + i * 3,
    reuniao: 5 + i * 2,
    fechado: 1 + i,
  }));

  const renderPieLabel = ({ name, percent, cx, cy, midAngle, outerRadius }: any) => {
    const RADIAN = Math.PI / 180;
    const radius = outerRadius + 25;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return (
      <text x={x} y={y} fill="hsl(0,0%,80%)" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={12} fontWeight={500}>
        {name} ({(percent * 100).toFixed(0)}%)
      </text>
    );
  };

  return (
    <AppLayout title="Relatórios" actions={
      <Button variant="outline" className="border-border text-foreground h-8 sm:h-9 text-xs sm:text-sm">
        <Download size={14} className="mr-1 sm:mr-2" /> Exportar
      </Button>
    }>
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 animate-fade-in">
        {[
          ['Potencial Total', formatCurrency(potencialTotal), false],
          ['Receita Fechada', formatCurrency(receitaFechada), true],
          ['Ticket Médio', formatCurrency(ticketMedio), false],
          ['Ciclo Médio', '18 dias', false],
        ].map(([l, v, a]) => (
          <div key={l as string} className={`card-premium p-4 sm:p-5 hover-scale ${a ? 'border-l-2 border-l-primary' : ''}`}>
            <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider mb-1">{l as string}</p>
            <p className={`text-xl sm:text-2xl font-bold ${a ? 'text-primary' : 'text-foreground'}`}>{v as string}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Vendor conversion */}
        {vendedorData.length > 0 && (
          <div className="card-premium p-5 sm:p-6">
            <h3 className="text-sm font-semibold text-foreground mb-4">Conversão por Vendedor</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={vendedorData} layout="vertical" margin={{ left: 0, right: 20, top: 0, bottom: 0 }}>
                <XAxis type="number" tick={{ fill: GRAY, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={70} tick={{ fill: LIGHT, fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="taxa" fill={GOLD} radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Revenue distribution */}
        <div className="card-premium p-5 sm:p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">Distribuição por Faturamento</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={faturamentoData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={90}
                label={renderPieLabel}
                labelLine={{ stroke: 'hsl(0,0%,40%)' }}
              >
                {faturamentoData.map((_, i) => (
                  <Cell key={i} fill={[GOLD, ORANGE, BLUE, GREEN, LIGHT][i % 5]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Pain points */}
        <div className="card-premium p-5 sm:p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">Principais Dores</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={doresData} layout="vertical" margin={{ left: 0, right: 20, top: 0, bottom: 0 }}>
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="name"
                width={120}
                tick={{ fill: LIGHT, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="value" fill={GOLD} radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Profile pie */}
        <div className="card-premium p-5 sm:p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">Perfil da Base</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={perfilData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={85}
                label={renderPieLabel}
                labelLine={{ stroke: 'hsl(0,0%,40%)' }}
              >
                <Cell fill={GOLD} />
                <Cell fill={BLUE} />
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Pipeline evolution */}
        <div className="card-premium p-5 sm:p-6 lg:col-span-2">
          <h3 className="text-sm font-semibold text-foreground mb-4">Evolução do Pipeline</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={pipelineEvolution} margin={{ left: 0, right: 8, top: 0, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fill: LIGHT, fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: GRAY, fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ color: 'hsl(0,0%,80%)', fontSize: 12, paddingTop: 8 }} />
              <Area type="monotone" dataKey="novos" stackId="1" fill={BLUE} stroke={BLUE} fillOpacity={0.3} />
              <Area type="monotone" dataKey="contato" stackId="1" fill={GOLD} stroke={GOLD} fillOpacity={0.3} />
              <Area type="monotone" dataKey="reuniao" stackId="1" fill={ORANGE} stroke={ORANGE} fillOpacity={0.3} />
              <Area type="monotone" dataKey="fechado" stackId="1" fill={GREEN} stroke={GREEN} fillOpacity={0.3} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </AppLayout>
  );
}
