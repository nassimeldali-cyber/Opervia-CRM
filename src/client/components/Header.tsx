import React from 'react';
import { Plus, Bell, ChevronDown, CheckCircle2 } from 'lucide-react';
import { Company, User } from '../api';

interface HeaderProps {
  activeCompany: Company | null;
  companies: Company[];
  user: User | null;
  onSelectCompany: (company: Company) => void;
  onNewOrderClick: () => void;
  onShowOnboarding: () => void;
  pageTitle: string;
}

export const Header: React.FC<HeaderProps> = ({
  activeCompany,
  companies,
  onSelectCompany,
  onNewOrderClick,
  onShowOnboarding,
  pageTitle,
}) => {
  const [dropdownOpen, setDropdownOpen] = React.useState(false);

  return (
    <header className="h-14 border-b border-slate-200 bg-white px-6 flex items-center justify-between shrink-0 z-10">
      <div className="flex items-center gap-4">
        <h2 className="text-base font-semibold text-slate-800">{pageTitle}</h2>

        {/* Tenant selector if user belongs to multiple companies */}
        {companies.length > 1 && (
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded border border-slate-200"
            >
              <span>{activeCompany?.name}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
            </button>

            {dropdownOpen && (
              <div className="absolute left-0 mt-1 w-56 bg-white rounded-md shadow-lg border border-slate-200 py-1 z-30">
                <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Changer d'entreprise
                </div>
                {companies.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      onSelectCompany(c);
                      setDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-50 ${
                      c.id === activeCompany?.id ? 'font-semibold text-emerald-600 bg-emerald-50/50' : 'text-slate-700'
                    }`}
                  >
                    <span className="truncate">{c.name}</span>
                    {c.id === activeCompany?.id && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Onboarding checklist button */}
        <button
          onClick={onShowOnboarding}
          className="text-xs text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-300 px-2.5 py-1.5 rounded font-medium flex items-center gap-1.5"
        >
          <span>Guide de démarrage</span>
        </button>

        {/* Quick New Order */}
        <button
          onClick={onNewOrderClick}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-medium shadow-sm transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Nouvelle Commande</span>
        </button>

        {/* Notification bell */}
        <div className="p-2 text-slate-500 hover:text-slate-700 rounded cursor-pointer transition-colors">
          <Bell className="w-4 h-4" />
        </div>
      </div>
    </header>
  );
};
