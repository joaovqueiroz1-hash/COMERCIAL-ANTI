import { AppLayout } from "@/components/layout/AppLayout";

export default function InternalChat() {
  return (
    <AppLayout>
      <div className="flex flex-col h-full bg-background/50 overflow-hidden">
        <header className="px-6 py-6 border-b border-border/40 bg-zinc-900/20 backdrop-blur-md">
          <h1 className="text-2xl font-bold text-foreground">
            Canal de Atendimento Interno
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Espaço único e oficial para comunicação entre a Mentoria e o Aluno.
          </p>
        </header>
        
        <main className="flex-1 p-6 overflow-y-auto">
          <div className="bg-zinc-900/30 rounded-2xl border border-border/40 p-10 text-center flex flex-col items-center justify-center">
             <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mb-4">
                <span className="text-2xl">💬</span>
             </div>
             <h2 className="text-xl font-bold text-white mb-2">Chat Interno em Construção</h2>
             <p className="text-muted-foreground max-w-md">
               A equipe conversará diretamente com os alunos através desta tela. (O módulo base será focado no Supabase Realtime).
             </p>
          </div>
        </main>
      </div>
    </AppLayout>
  );
}
