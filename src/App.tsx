import { lazy, Suspense, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useAuth } from "@/contexts/AuthContext";

// Páginas leves — carregadas junto com o bundle principal
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

// Páginas pesadas — carregadas sob demanda (code splitting)
const Dashboard        = lazy(() => import("./pages/Dashboard"));
const Pipeline         = lazy(() => import("./pages/Pipeline"));
const Leads            = lazy(() => import("./pages/Leads"));
const LeadDetail       = lazy(() => import("./pages/LeadDetail"));
const Agenda           = lazy(() => import("./pages/Agenda"));
const Relatorios       = lazy(() => import("./pages/Relatorios"));
const Equipe           = lazy(() => import("./pages/Equipe"));
const Configuracoes    = lazy(() => import("./pages/Configuracoes"));
const PortalAluno      = lazy(() => import("./pages/PortalAluno"));
const GestaoOperacional = lazy(() => import("./pages/GestaoOperacional"));
const InternalChat     = lazy(() => import("./pages/InternalChat"));
const Metas            = lazy(() => import("./pages/Metas"));
const Historico        = lazy(() => import("./pages/Historico"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,     // 2 min: não refaz fetch se dado ainda é fresco
      gcTime: 1000 * 60 * 10,       // 10 min: mantém na memória quando sem observer
      retry: 1,                      // apenas 1 retry em vez de 3
      refetchOnWindowFocus: false,   // não refetcha ao trocar de aba
    },
  },
});

function PageLoader() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function RootRedirect() {
  const { user, profile, loading } = useAuth();
  // Mostra spinner enquanto a sessão/perfil carrega — nunca retorna null
  if (loading) return <PageLoader />;
  // Sem usuário ou sem perfil → login
  if (!user || !profile) return <Navigate to="/login" replace />;
  // Redireciona pelo perfil
  if (profile.perfil === "aluno") return <Navigate to="/portal" replace />;
  return <Navigate to="/dashboard" replace />;
}

const App = () => {
  // Cancela o timer de detecção de tela preta definido em index.html
  useEffect(() => {
    const t = (window as any).__startupTimer;
    if (t) { clearTimeout(t); (window as any).__startupTimer = null; }
  }, []);

  return (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<RootRedirect />} />
                <Route path="/login" element={<Login />} />

                {/* Admin / Gestor / Operacional */}
                <Route path="/dashboard"       element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/pipeline"        element={<ProtectedRoute><Pipeline /></ProtectedRoute>} />
                <Route path="/leads"           element={<ProtectedRoute><Leads /></ProtectedRoute>} />
                <Route path="/leads/:id"       element={<ProtectedRoute><LeadDetail /></ProtectedRoute>} />
                <Route path="/agenda"          element={<ProtectedRoute><Agenda /></ProtectedRoute>} />
                <Route path="/metas"           element={<ProtectedRoute><Metas /></ProtectedRoute>} />
                <Route path="/historico"       element={<ProtectedRoute><Historico /></ProtectedRoute>} />
                <Route path="/relatorios"      element={<ProtectedRoute><Relatorios /></ProtectedRoute>} />
                <Route path="/equipe"          element={<ProtectedRoute><Equipe /></ProtectedRoute>} />
                <Route path="/configuracoes"   element={<ProtectedRoute><Configuracoes /></ProtectedRoute>} />

                {/* Aluno */}
                <Route path="/portal"          element={<ProtectedRoute><PortalAluno /></ProtectedRoute>} />

                {/* Operacional */}
                <Route path="/gestao-operacional" element={<ProtectedRoute><GestaoOperacional /></ProtectedRoute>} />
                <Route path="/suporte-interno"    element={<ProtectedRoute><InternalChat /></ProtectedRoute>} />

                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
  );
};

export default App;
