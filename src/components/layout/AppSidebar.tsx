import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Kanban, Users, Calendar, BarChart3,
  UsersRound, Settings, X, LogOut, MessageSquare, Target, History,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getInitials } from '@/lib/types';
import lvLogo from '@/assets/Logo-LV-Branco.png';

const navItems = [
  { to: '/dashboard',          label: 'Dashboard',          icon: LayoutDashboard, roles: ['admin', 'gestor'] },
  { to: '/pipeline',           label: 'Pipeline',            icon: Kanban,          roles: ['admin', 'gestor', 'vendedor'] },
  { to: '/leads',              label: 'Leads',               icon: Users,           roles: ['admin', 'gestor', 'vendedor'] },
  { to: '/gestao-operacional', label: 'Gestão de Mentoria',  icon: UsersRound,      roles: ['admin', 'operacional'] },
  { to: '/portal',             label: 'Meu Portal',          icon: LayoutDashboard, roles: ['aluno'] },
  { to: '/suporte-interno',    label: 'Mensagens',           icon: MessageSquare,   roles: ['admin', 'operacional', 'aluno'], badge: 'CHAT' },
  { to: '/agenda',             label: 'Agenda',              icon: Calendar,        roles: ['admin', 'gestor', 'vendedor', 'operacional', 'aluno'] },
  { to: '/metas',              label: 'Metas',               icon: Target,          roles: ['admin', 'gestor', 'vendedor', 'operacional'] },
  { to: '/historico',          label: 'Histórico',           icon: History,         roles: ['admin', 'gestor'] },
  { to: '/relatorios',         label: 'Relatórios',          icon: BarChart3,       roles: ['admin', 'gestor'] },
  { to: '/equipe',             label: 'Equipe',              icon: UsersRound,      roles: ['admin'] },
  { to: '/configuracoes',      label: 'Configurações',       icon: Settings,        roles: ['admin'] },
];

const perfilLabels: Record<string, string> = {
  admin: 'Admin | Master',
  gestor: 'Gestão Comercial',
  vendedor: 'Comercial',
  operacional: 'Equipe Mentoria',
  aluno: 'Aluno (Mentorado)',
};

interface AppSidebarProps {
  onClose: () => void;
}

export function AppSidebar({ onClose }: AppSidebarProps) {
  const location = useLocation();
  const { profile, signOut } = useAuth();

  return (
    <div
      className="w-[230px] h-full flex flex-col select-none border-r border-border"
      style={{ background: 'hsl(var(--sidebar-background))' }}
    >
      {/* ── Logo ── */}
      <div className="px-5 pt-6 pb-5 border-b border-border relative">
        <div className="flex items-center justify-center">
          <img
            src={lvLogo}
            alt="LV Business Club"
            className="w-24 h-auto object-contain"
            style={{ filter: 'invert(1) brightness(0)' }}
          />
        </div>
        <button
          onClick={onClose}
          className="md:hidden absolute top-3 right-3 text-muted-foreground hover:text-foreground"
        >
          <X size={16} />
        </button>
      </div>

      {/* ── Nav section label ── */}
      <div className="px-4 pt-4 pb-1.5">
        <span className="text-[9px] font-bold tracking-[0.22em] uppercase text-muted-foreground/60">
          Menu
        </span>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 px-2 space-y-0.5 overflow-y-auto pb-2">
        {navItems.filter(item => profile ? item.roles.includes(profile.perfil) : false).map((item) => {
          const isActive = location.pathname.startsWith(item.to);
          const cs = (item as any).comingSoon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all relative group ${
                cs
                  ? 'text-muted-foreground/40 cursor-default pointer-events-none'
                  : isActive
                  ? 'sidebar-item-active text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-black/[0.06]'
              }`}
            >
              <item.icon
                size={17}
                className={`shrink-0 transition-colors ${
                  cs
                    ? 'text-muted-foreground/30'
                    : isActive
                    ? 'text-primary'
                    : 'text-muted-foreground group-hover:text-foreground/60'
                }`}
              />
              <span className="flex-1 truncate">{item.label}</span>
              {(item as any).badge && (
                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full tracking-widest shrink-0 ${
                  cs
                    ? 'bg-muted text-muted-foreground/50'
                    : 'bg-primary text-primary-foreground'
                }`}>
                  {(item as any).badge}
                </span>
              )}
              {isActive && !cs && (
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary rounded-l-full" />
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* ── User profile ── */}
      <div className="p-3 border-t border-border">
        <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-secondary/60">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-primary-foreground shrink-0">
            {profile ? getInitials(profile.nome) : '?'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-foreground truncate">
              {profile?.nome ?? 'Carregando...'}
            </p>
            <p className="text-[9px] text-muted-foreground">
              {profile ? perfilLabels[profile.perfil] ?? profile.perfil : ''}
            </p>
          </div>
          <button
            onClick={signOut}
            title="Sair"
            className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded-lg hover:bg-destructive/10"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
