import { AppLayout } from '@/components/layout/AppLayout';
import { MessageSquare, Zap, Bell, BarChart2, Users, Rocket } from 'lucide-react';

const features = [
  {
    icon: MessageSquare,
    title: 'CRM Unificado',
    description: 'Todas as conversas do Instagram e WhatsApp em um só lugar, vinculadas ao lead automaticamente.',
  },
  {
    icon: Zap,
    title: 'Automações Inteligentes',
    description: 'Respostas automáticas, sequências de follow-up e gatilhos personalizados por etapa do funil.',
  },
  {
    icon: Bell,
    title: 'Notificações em Tempo Real',
    description: 'Alertas instantâneos de novas mensagens para nunca perder uma oportunidade.',
  },
  {
    icon: BarChart2,
    title: 'Analytics de Conversas',
    description: 'Taxa de resposta, tempo médio de atendimento e métricas de conversão por canal.',
  },
  {
    icon: Users,
    title: 'Multi-vendedor',
    description: 'Distribua conversas entre o time e acompanhe o desempenho de cada vendedor.',
  },
  {
    icon: Rocket,
    title: 'Disparo em Massa',
    description: 'Envie campanhas segmentadas diretamente pelo pipeline, com rastreamento de entrega.',
  },
];

export default function WhatsAppCRM() {
  return (
    <AppLayout title="CRM" subtitle="Em breve">
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-160px)] px-4 animate-fade-in">
        {/* Badge */}
        <div className="mb-6 flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/5">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          <span className="text-xs font-semibold text-primary tracking-widest uppercase">Em desenvolvimento — V2</span>
        </div>

        {/* Icon */}
        <div className="mb-6 w-20 h-20 rounded-2xl gold-gradient flex items-center justify-center shadow-lg">
          <MessageSquare size={38} className="text-primary-foreground" />
        </div>

        {/* Headline */}
        <h1 className="text-3xl font-bold text-foreground text-center mb-3 leading-tight">
          CRM Integrado está a caminho
        </h1>
        <p className="text-muted-foreground text-center max-w-md mb-12 leading-relaxed">
          Estamos construindo uma experiência completa de atendimento e gestão de conversas
          diretamente integrada ao seu pipeline de vendas.
        </p>

        {/* Feature grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-3xl mb-12">
          {features.map((f) => (
            <div
              key={f.title}
              className="card-premium p-4 flex flex-col gap-3 hover:border-primary/30 transition-all"
            >
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <f.icon size={18} className="text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground mb-1">{f.title}</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{f.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer note */}
        <p className="text-[11px] text-muted-foreground/50 text-center">
          Continue usando o Pipeline para gerenciar seus leads enquanto o CRM V2 é preparado.
        </p>
      </div>
    </AppLayout>
  );
}
