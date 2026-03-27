import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Kanban, Users, Calendar, BarChart3,
  UsersRound, Settings, X, LogOut, MessageSquare,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getInitials } from '@/lib/types';
import lvLogo from '@/assets/Logo-LV-Branco.png';
import lvIcon from '@/assets/LV-Icon-Branco.png';

const navItems = [
  { to: '/dashboard',    label: 'Dashboard',      icon: LayoutDashboard },
  { to: '/whatsapp-crm', label: 'WhatsApp CRM',   icon: MessageSquare, badge: 'NOVO' },
  { to: '/pipeline',     label: 'Pipeline',        icon: Kanban },
  { to: '/leads',        label: 'Leads',           icon: Users },
  { to: '/agenda',       label: 'Agenda',          icon: Calendar },
  { to: '/relatorios',   label: 'Relatórios',      icon: BarChart3 },
  { to: '/equipe',       label: 'Equipe',          icon: UsersRound },
  { to: '/configuracoes',label: 'Configurações',   icon: Settings },
];

const perfilLabels: Record<string, string> = {
  admin: 'Admin Master',
  gestor: 'Gestora Comercial',
  vendedor: 'Vendedor(a)',
};

interface AppSidebarProps {
  onClose: () => void;
}

export function AppSidebar({ onClose }: AppSidebarProps) {
  const location = useLocation();
  const { profile, signOut } = useAuth();

  return (
    <div
      className="w-[230px] h-full flex flex-col select-none"
      style={{ background: 'hsl(224, 24%, 5%)' }}
    >
      {/* ── Logo ── */}
      <div className="px-5 pt-5 pb-4 border-b border-border/40">
        <div className="flex items-center gap-3">
          {/* Icon mark */}
          <img
            src={lvIcon}
            alt="LV"
            className="h-10 w-10 object-contain shrink-0"
          />
          {/* Full wordmark / Texto */}
          <div className="flex flex-col leading-tight justify-center">
            <span className="text-sm font-bold text-foreground tracking-wide">
              Business Club
            </span>
            <span className="text-[9px] font-semibold tracking-[0.22em] uppercase text-muted-foreground mt-0.5">
              Mentoria High Ticket
            </span>
          </div>
        </div>
        {/* Mobile close */}
        <button
          onClick={onClose}
          className="md:hidden absolute top-4 right-4 text-muted-foreground hover:text-foreground"
        >
          <X size={16} />
        </button>
      </div>

      {/* ── Nav section label ── */}
      <div className="px-4 pt-4 pb-1.5">
        <span className="text-[9px] font-bold tracking-[0.22em] uppercase text-muted-foreground/50">
          Menu
        </span>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 px-2 space-y-0.5 overflow-y-auto pb-2">
        {navItems.map((item) => {
          const isActive = location.pathname.startsWith(item.to);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all relative group ${
                isActive
                  ? 'sidebar-item-active text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.04]'
              }`}
            >
              <item.icon
                size={17}
                className={`shrink-0 transition-colors ${
                  isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground/70'
                }`}
              />
              <span className="flex-1 truncate">{item.label}</span>
              {item.badge && (
                <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full gold-gradient text-primary-foreground tracking-widest shrink-0">
                  {item.badge}
                </span>
              )}
              {isActive && (
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary rounded-l-full" />
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* ── User profile ── */}
      <div className="p-3 border-t border-border/40">
        <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-secondary/40">
          <div className="w-8 h-8 rounded-full gold-gradient flex items-center justify-center text-xs font-bold text-primary-foreground shrink-0">
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
