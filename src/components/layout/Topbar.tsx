import { ReactNode, useState, useRef } from 'react';
import { Bell, Search, Menu, PanelLeftClose } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useNavigate } from 'react-router-dom';

interface TopbarProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  onMenuClick: () => void;
  sidebarOpen: boolean;
}

export function Topbar({ title, subtitle, actions, onMenuClick, sidebarOpen }: TopbarProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSearchToggle = () => {
    setSearchOpen((v) => {
      if (!v) setTimeout(() => inputRef.current?.focus(), 50);
      return !v;
    });
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      navigate(`/leads?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchOpen(false);
      setSearchQuery('');
    }
    if (e.key === 'Escape') {
      setSearchOpen(false);
      setSearchQuery('');
    }
  };

  return (
    <header className="h-16 border-b border-border bg-background flex items-center justify-between px-4 md:px-6 shrink-0">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          {sidebarOpen ? <PanelLeftClose size={20} /> : <Menu size={20} />}
        </button>
        <div>
          <h1 className="text-lg font-semibold text-foreground">{title}</h1>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className={`transition-all duration-200 ${searchOpen ? 'w-56' : 'w-0'} overflow-hidden`}>
          <Input
            ref={inputRef}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Buscar lead... (Enter)"
            className="h-9 bg-secondary border-border text-sm"
          />
        </div>
        <button
          onClick={handleSearchToggle}
          className={`transition-colors ${searchOpen ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          title="Buscar (Enter para ir)"
        >
          <Search size={18} />
        </button>

        <button
          className="text-muted-foreground hover:text-foreground transition-colors"
          title="Notificações (em breve)"
        >
          <Bell size={18} />
        </button>

        {actions}
      </div>
    </header>
  );
}
