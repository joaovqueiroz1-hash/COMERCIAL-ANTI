import { ReactNode, useState } from 'react';
import { Bell, Search, Menu, PanelLeftClose } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface TopbarProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  onMenuClick: () => void;
  sidebarOpen: boolean;
}

export function Topbar({ title, subtitle, actions, onMenuClick, sidebarOpen }: TopbarProps) {
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <header className="h-16 border-b border-border bg-bg-secondary flex items-center justify-between px-4 md:px-6 shrink-0">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          {sidebarOpen ? <PanelLeftClose size={20} /> : <Menu size={20} />}
        </button>
        <div>
          <h1 className="text-lg font-semibold text-foreground">{title}</h1>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Search */}
        <div className={`transition-all ${searchOpen ? 'w-64' : 'w-0'} overflow-hidden`}>
          <Input
            placeholder="Buscar lead, empresa, telefone..."
            className="h-9 bg-bg-tertiary border-border text-sm"
          />
        </div>
        <button
          onClick={() => setSearchOpen(!searchOpen)}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <Search size={18} />
        </button>

        {/* Notifications */}
        <button className="relative text-muted-foreground hover:text-foreground transition-colors">
          <Bell size={18} />
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-danger rounded-full" />
        </button>

        {/* Actions */}
        {actions}
      </div>
    </header>
  );
}
