import React from 'react';
import {
  LayoutDashboard,
  MessageSquare,
  Package,
  Users,
  ShoppingBag,
  Zap,
  Send,
  BarChart3,
  CheckSquare,
  Plug,
  UserCheck,
  CreditCard,
  Settings,
  Shield,
  LogOut,
  Building2,
} from 'lucide-react';
import { User, Company } from '../api';

export type NavTab =
  | 'dashboard'
  | 'inbox'
  | 'orders'
  | 'customers'
  | 'products'
  | 'automations'
  | 'campaigns'
  | 'analytics'
  | 'tasks'
  | 'integrations'
  | 'team'
  | 'subscription'
  | 'settings'
  | 'superadmin';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  user: User | null;
  activeCompany: Company | null;
  onLogout: () => void;
  unreadCount?: number;
  toConfirmCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  user,
  activeCompany,
  onLogout,
  unreadCount = 0,
  toConfirmCount = 0,
}) => {
  const navItems = [
    { id: 'dashboard' as NavTab, label: 'Tableau de bord', icon: LayoutDashboard },
    { id: 'inbox' as NavTab, label: 'Boîte de réception', icon: MessageSquare, badge: unreadCount > 0 ? unreadCount : undefined },
    { id: 'orders' as NavTab, label: 'Commandes COD', icon: Package, badge: toConfirmCount > 0 ? toConfirmCount : undefined, badgeColor: 'bg-amber-500' },
    { id: 'customers' as NavTab, label: 'Clients & CRM', icon: Users },
    { id: 'products' as NavTab, label: 'Catalogue Produits', icon: ShoppingBag },
    { id: 'automations' as NavTab, label: 'Automatisations', icon: Zap },
    { id: 'campaigns' as NavTab, label: 'Campagnes WhatsApp', icon: Send },
    { id: 'analytics' as NavTab, label: 'Rapports & Stats', icon: BarChart3 },
    { id: 'tasks' as NavTab, label: 'Tâches & Rappels', icon: CheckSquare },
    { id: 'integrations' as NavTab, label: 'Intégrations', icon: Plug },
    { id: 'team' as NavTab, label: 'Équipe & Accès', icon: UserCheck },
    { id: 'subscription' as NavTab, label: 'Abonnement', icon: CreditCard },
    { id: 'settings' as NavTab, label: 'Paramètres', icon: Settings },
  ];

  if (user?.is_superadmin) {
    navItems.push({ id: 'superadmin' as NavTab, label: 'SuperAdmin Plateforme', icon: Shield });
  }

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 border-r border-slate-800 select-none">
      {/* Brand & Workspace Header */}
      <div className="p-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold tracking-wider text-lg shadow-sm">
            O
          </div>
          <div>
            <h1 className="font-semibold text-white text-base tracking-tight leading-tight">Opervia</h1>
            <p className="text-xs text-slate-400">CRM E-Commerce & WhatsApp</p>
          </div>
        </div>

        {activeCompany && (
          <div className="mt-3.5 px-3 py-2 rounded-md bg-slate-800/80 border border-slate-700/60 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <div className="truncate flex-1">
              <p className="text-xs font-medium text-slate-200 truncate">{activeCompany.name}</p>
              <p className="text-[10px] text-slate-400">Devise : {activeCompany.currency} (DT)</p>
            </div>
          </div>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-0.5 custom-scrollbar">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-emerald-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-2.5 truncate">
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span className="truncate">{item.label}</span>
              </div>
              {item.badge !== undefined && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold text-white shrink-0 ${
                    item.badgeColor || 'bg-emerald-500'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* User info & Logout footer */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/40">
        <div className="flex items-center justify-between">
          <div className="truncate flex-1 pr-2">
            <p className="text-xs font-medium text-white truncate">{user?.full_name}</p>
            <p className="text-[10px] text-slate-400 truncate">{user?.email}</p>
          </div>
          <button
            onClick={onLogout}
            title="Se déconnecter"
            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
