import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Pipeline from "./pages/Pipeline";
import Leads from "./pages/Leads";
import LeadDetail from "./pages/LeadDetail";
import Agenda from "./pages/Agenda";
import Relatorios from "./pages/Relatorios";
import Equipe from "./pages/Equipe";
import Configuracoes from "./pages/Configuracoes";
import NotFound from "./pages/NotFound";
import { useAuth } from '@/contexts/AuthContext';

// Novas Páginas (Stubs provisórios)
import PortalAluno from "./pages/PortalAluno";
import GestaoOperacional from "./pages/GestaoOperacional";
import InternalChat from "./pages/InternalChat";

const queryClient = new QueryClient();

function RootRedirect() {
  const { profile, loading } = useAuth();
  if (loading) return null;
  if (!profile) return <Navigate to="/login" replace />;
  if (profile.perfil === 'aluno') return <Navigate to="/portal" replace />;
  return <Navigate to="/dashboard" replace />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/login" element={<Login />} />
            
            {/* Visão Compartilhada Admin/Gestor/Operacional */}
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/pipeline" element={<ProtectedRoute><Pipeline /></ProtectedRoute>} />
            <Route path="/leads" element={<ProtectedRoute><Leads /></ProtectedRoute>} />
            <Route path="/leads/:id" element={<ProtectedRoute><LeadDetail /></ProtectedRoute>} />
            <Route path="/agenda" element={<ProtectedRoute><Agenda /></ProtectedRoute>} />
            <Route path="/relatorios" element={<ProtectedRoute><Relatorios /></ProtectedRoute>} />
            <Route path="/equipe" element={<ProtectedRoute><Equipe /></ProtectedRoute>} />
            <Route path="/configuracoes" element={<ProtectedRoute><Configuracoes /></ProtectedRoute>} />
            
            {/* Visão Aluno */}
            <Route path="/portal" element={<ProtectedRoute><PortalAluno /></ProtectedRoute>} />
            
            {/* Visão Operacional Mentoria */}
            <Route path="/gestao-operacional" element={<ProtectedRoute><GestaoOperacional /></ProtectedRoute>} />

            {/* Canal Único Chat (Ocupando o lugar do antigo WhatsAppCRM) */}
            <Route path="/suporte-interno" element={<ProtectedRoute><InternalChat /></ProtectedRoute>} />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
