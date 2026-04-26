import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";

export default function PortalAluno() {
  const { profile } = useAuth();
  
  return (
    <AppLayout>
      <div className="flex flex-col h-full bg-background/50 overflow-hidden">
        <header className="px-6 py-6 border-b border-border/40 bg-zinc-900/20 backdrop-blur-md">
          <h1 className="text-2xl font-bold text-foreground">
            Meu Portal
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Bem-vindo(a), {profile?.nome}. Aqui você acompanha suas entregas e materiais.
          </p>
        </header>
        
        <main className="flex-1 p-6 overflow-y-auto">
          {/* Sessão Resumo Sprints / Tarefas / Pontos */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="p-6 bg-zinc-900/50 rounded-2xl border border-border/40">
              <h3 className="text-zinc-400 font-semibold mb-2">Fase Atual</h3>
              <p className="text-2xl font-bold gold-gradient bg-clip-text text-transparent">Onboarding</p>
            </div>
            <div className="p-6 bg-zinc-900/50 rounded-2xl border border-border/40">
              <h3 className="text-zinc-400 font-semibold mb-2">Progresso (Sprints)</h3>
              <p className="text-2xl font-bold text-white">0%</p>
            </div>
            <div className="p-6 bg-zinc-900/50 rounded-2xl border border-border/40">
              <h3 className="text-zinc-400 font-semibold mb-2">Sua Pontuação</h3>
              <p className="text-2xl font-bold text-emerald-400">0 XP</p>
            </div>
          </div>

          {/* Sessão Próximas Tarefas */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-foreground mb-4">Minhas Tarefas</h2>
            <div className="bg-zinc-900/30 rounded-2xl border border-border/40 p-10 text-center">
              <p className="text-muted-foreground">Nenhuma tarefa pendente no momento.</p>
            </div>
          </section>

          {/* Sessão Arquivos */}
          <section>
            <h2 className="text-xl font-bold text-foreground mb-4">Materiais Liberados</h2>
            <div className="bg-zinc-900/30 rounded-2xl border border-border/40 p-10 text-center">
              <p className="text-muted-foreground">Você ainda não tem arquivos compartilhados.</p>
            </div>
          </section>

        </main>
      </div>
    </AppLayout>
  );
}
