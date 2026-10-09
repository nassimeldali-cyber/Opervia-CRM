import React, { useEffect, useState } from 'react';
import { api, User, Company } from './client/api';
import { Sidebar, NavTab } from './client/components/Sidebar';
import { Header } from './client/components/Header';
import { AuthView } from './client/views/AuthView';
import { DashboardView } from './client/views/DashboardView';
import { OrdersView } from './client/views/OrdersView';
import { InboxView } from './client/views/InboxView';
import { CustomersView } from './client/views/CustomersView';
import { ProductsView } from './client/views/ProductsView';
import { AutomationsView } from './client/views/AutomationsView';
import { CampaignsView } from './client/views/CampaignsView';
import { AnalyticsView } from './client/views/AnalyticsView';
import { TasksView } from './client/views/TasksView';
import { IntegrationsView } from './client/views/IntegrationsView';
import { TeamView } from './client/views/TeamView';
import { SubscriptionView } from './client/views/SubscriptionView';
import { SettingsView } from './client/views/SettingsView';
import { SuperAdminView } from './client/views/SuperAdminView';
import { OnboardingWizard } from './client/components/OnboardingWizard';
import { RefreshCw } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeCompany, setActiveCompany] = useState<Company | null>(null);
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [loading, setLoading] = useState(true);

  // Modals & UI triggers
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isQuickOrderOpen, setIsQuickOrderOpen] = useState(false);

  // Badge counters
  const [toConfirmCount, setToConfirmCount] = useState(0);
  const [unreadMsgCount, setUnreadMsgCount] = useState(0);

  // Verify session on mount
  useEffect(() => {
    const initSession = async () => {
      const token = api.getToken();
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const res = await api.get<{ user: User; companies: Company[] }>('/api/auth/me');
        setUser(res.user);
        setCompanies(res.companies);

        const storedTenantId = api.getActiveTenantId();
        const active = res.companies.find((c) => c.id === storedTenantId) || res.companies[0] || null;
        if (active) {
          setActiveCompany(active);
          api.setActiveTenantId(active.id);
        }
      } catch (err) {
        console.error('Session validation failed:', err);
        api.clearToken();
      } finally {
        setLoading(false);
      }
    };

    initSession();
  }, []);

  // Poll badges periodically
  useEffect(() => {
    if (!user || !activeCompany) return;

    const fetchBadges = () => {
      api
        .get('/api/reports/dashboard')
        .then((res) => {
          if (res?.metrics) {
            setToConfirmCount(res.metrics.toConfirm || 0);
            setUnreadMsgCount(res.metrics.unreadMessages || 0);
          }
        })
        .catch(() => {});
    };

    fetchBadges();
    const interval = setInterval(fetchBadges, 20000);
    return () => clearInterval(interval);
  }, [user, activeCompany]);

  const handleLoginSuccess = (u: User, comps: Company[], active: Company | null) => {
    setUser(u);
    setCompanies(comps);
    setActiveCompany(active);
    setCurrentTab('dashboard');
  };

  const handleLogout = () => {
    api.clearToken();
    setUser(null);
    setCompanies([]);
    setActiveCompany(null);
    setCurrentTab('dashboard');
  };

  const handleSelectCompany = (comp: Company) => {
    setActiveCompany(comp);
    api.setActiveTenantId(comp.id);
    window.location.reload();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-bold text-xl shadow-md">
            O
          </div>
          <RefreshCw className="w-5 h-5 text-emerald-400 animate-spin" />
          <p className="text-xs text-slate-400 font-medium">Chargement d'Opervia CRM...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthView onLoginSuccess={handleLoginSuccess} />;
  }

  const tabTitles: Record<NavTab, string> = {
    dashboard: 'Tableau de bord',
    inbox: 'Boîte de réception omnicanale',
    orders: 'Gestion des Commandes COD (Tunisie)',
    customers: 'Base de données Clients & CRM',
    products: 'Catalogue de Produits & Stock',
    automations: 'Moteur d\'Automatisations',
    campaigns: 'Campagnes & Diffusions WhatsApp',
    analytics: 'Rapports & Statistiques Logistiques',
    tasks: 'Tâches & Rappels Opérationnels',
    integrations: 'Connecteurs & Passerelles E-Commerce',
    team: 'Gestion de l\'Équipe & Rôles',
    subscription: 'Abonnement & Facturation SaaS',
    settings: 'Paramètres Généraux',
    superadmin: 'Portail SuperAdmin Plateforme',
  };

  return (
    <div className="flex h-screen bg-slate-100 font-sans antialiased text-slate-800 overflow-hidden">
      {/* Persistent Left Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        user={user}
        activeCompany={activeCompany}
        onLogout={handleLogout}
        unreadCount={unreadMsgCount}
        toConfirmCount={toConfirmCount}
      />

      {/* Main View Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          activeCompany={activeCompany}
          companies={companies}
          user={user}
          onSelectCompany={handleSelectCompany}
          onNewOrderClick={() => setIsQuickOrderOpen(true)}
          onShowOnboarding={() => setIsOnboardingOpen(true)}
          pageTitle={tabTitles[currentTab] || 'Opervia'}
        />

        <main className="flex-1 overflow-y-auto">
          {currentTab === 'dashboard' && <DashboardView onNavigate={setCurrentTab} />}
          {currentTab === 'inbox' && <InboxView onOpenNewOrder={() => setIsQuickOrderOpen(true)} />}
          {currentTab === 'orders' && (
            <OrdersView
              initialCreateModalOpen={isQuickOrderOpen}
              onCloseCreateModal={() => setIsQuickOrderOpen(false)}
            />
          )}
          {currentTab === 'customers' && <CustomersView />}
          {currentTab === 'products' && <ProductsView />}
          {currentTab === 'automations' && <AutomationsView />}
          {currentTab === 'campaigns' && <CampaignsView />}
          {currentTab === 'analytics' && <AnalyticsView />}
          {currentTab === 'tasks' && <TasksView />}
          {currentTab === 'integrations' && <IntegrationsView />}
          {currentTab === 'team' && <TeamView />}
          {currentTab === 'subscription' && <SubscriptionView />}
          {currentTab === 'settings' && <SettingsView />}
          {currentTab === 'superadmin' && <SuperAdminView />}
        </main>
      </div>

      {/* Guided Onboarding Checklist Modal */}
      <OnboardingWizard
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        onNavigate={setCurrentTab}
      />
    </div>
  );
}
