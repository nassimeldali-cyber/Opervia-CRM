import React, { useEffect, useState } from 'react';
import {
  Package,
  Clock,
  CheckCircle,
  Truck,
  AlertTriangle,
  RotateCcw,
  Banknote,
  Users,
  MessageSquare,
  ArrowRight,
  TrendingUp,
  MapPin,
  RefreshCw,
} from 'lucide-react';
import { api } from '../api';
import { NavTab } from '../components/Sidebar';

interface DashboardMetrics {
  totalOrders: number;
  ordersToday: number;
  toConfirm: number;
  confirmed: number;
  preparing: number;
  shipped: number;
  delivered: number;
  refused: number;
  returned: number;
  unreachable: number;
  cancelled: number;
  totalRevenueTnd: number;
  deliveredRevenueTnd: number;
  deliverySuccessRate: number;
  refusalRate: number;
  customerCount: number;
  openConversations: number;
  unreadMessages: number;
  pendingTasks: number;
}

interface DashboardData {
  metrics: DashboardMetrics;
  countsMap: Record<string, number>;
  governorateStats: Array<{ governorate: string; order_count: number; total_amount: number }>;
  channelStats: Array<{ source_channel: string; count: number }>;
  integrations: Array<{ type: string; name: string; status: string; last_sync_at: string }>;
}

export const DashboardView: React.FC<{ onNavigate: (tab: NavTab) => void }> = ({ onNavigate }) => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get<DashboardData>('/api/reports/dashboard');
      setData(res);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-2">
          <RefreshCw className="w-6 h-6 text-emerald-600 animate-spin" />
          <p className="text-xs text-slate-500 font-medium">Chargement des indicateurs en direct...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8">
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs">
          Erreur de chargement du tableau de bord : {error}
        </div>
      </div>
    );
  }

  const { metrics, governorateStats, integrations } = data;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner with Alert for Orders to Confirm */}
      {metrics.toConfirm > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-amber-900">
                {metrics.toConfirm} commande{metrics.toConfirm > 1 ? 's' : ''} en attente de confirmation téléphonique
              </p>
              <p className="text-[11px] text-amber-700">
                La confirmation rapide par appel ou WhatsApp augmente le taux de livraison de 38% en Tunisie.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('orders')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium rounded transition-colors shrink-0"
          >
            <span>Traiter les commandes</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Commandes Aujourd'hui */}
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Commandes Aujourd'hui</span>
            <Package className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{metrics.ordersToday}</div>
          <div className="text-[11px] text-slate-500 mt-1">Total enregistré : {metrics.totalOrders} commandes</div>
        </div>

        {/* Chiffre d'Affaires Livré (TND) */}
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Revenu Encaissé (COD)</span>
            <Banknote className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{metrics.deliveredRevenueTnd.toLocaleString('fr-TN')} DT</div>
          <div className="text-[11px] text-slate-500 mt-1">Volume global : {metrics.totalRevenueTnd.toLocaleString('fr-TN')} DT</div>
        </div>

        {/* Taux de Livraison */}
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Taux de Livraison Réussie</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-700">{metrics.deliverySuccessRate}%</div>
          <div className="text-[11px] text-slate-500 mt-1">{metrics.delivered} colis livrés sur les finalisés</div>
        </div>

        {/* Taux de Refus */}
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Taux de Refus & Retours</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold text-rose-600">{metrics.refusalRate}%</div>
          <div className="text-[11px] text-slate-500 mt-1">
            {metrics.refused} refus · {metrics.returned} retours
          </div>
        </div>
      </div>

      {/* Pipeline Status Breakdown */}
      <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs">
        <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wider mb-4">
          Pipeline des Commandes COD (Cycle de Vie)
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          <div
            onClick={() => onNavigate('orders')}
            className="p-3 rounded bg-amber-50/60 border border-amber-200/80 cursor-pointer hover:bg-amber-50 transition-colors"
          >
            <div className="flex items-center gap-2 text-amber-700 mb-1">
              <Clock className="w-3.5 h-3.5" />
              <span className="text-[11px] font-semibold">À confirmer</span>
            </div>
            <div className="text-xl font-bold text-amber-900">{metrics.toConfirm}</div>
          </div>

          <div
            onClick={() => onNavigate('orders')}
            className="p-3 rounded bg-emerald-50/60 border border-emerald-200/80 cursor-pointer hover:bg-emerald-50 transition-colors"
          >
            <div className="flex items-center gap-2 text-emerald-700 mb-1">
              <CheckCircle className="w-3.5 h-3.5" />
              <span className="text-[11px] font-semibold">Confirmées</span>
            </div>
            <div className="text-xl font-bold text-emerald-900">{metrics.confirmed}</div>
          </div>

          <div
            onClick={() => onNavigate('orders')}
            className="p-3 rounded bg-indigo-50/60 border border-indigo-200/80 cursor-pointer hover:bg-indigo-50 transition-colors"
          >
            <div className="flex items-center gap-2 text-indigo-700 mb-1">
              <Package className="w-3.5 h-3.5" />
              <span className="text-[11px] font-semibold">En préparation</span>
            </div>
            <div className="text-xl font-bold text-indigo-900">{metrics.preparing}</div>
          </div>

          <div
            onClick={() => onNavigate('orders')}
            className="p-3 rounded bg-cyan-50/60 border border-cyan-200/80 cursor-pointer hover:bg-cyan-50 transition-colors"
          >
            <div className="flex items-center gap-2 text-cyan-700 mb-1">
              <Truck className="w-3.5 h-3.5" />
              <span className="text-[11px] font-semibold">Expédiées</span>
            </div>
            <div className="text-xl font-bold text-cyan-900">{metrics.shipped}</div>
          </div>

          <div
            onClick={() => onNavigate('orders')}
            className="p-3 rounded bg-green-50/60 border border-green-200/80 cursor-pointer hover:bg-green-50 transition-colors"
          >
            <div className="flex items-center gap-2 text-green-700 mb-1">
              <CheckCircle className="w-3.5 h-3.5" />
              <span className="text-[11px] font-semibold">Livrées (Payées)</span>
            </div>
            <div className="text-xl font-bold text-green-900">{metrics.delivered}</div>
          </div>

          <div
            onClick={() => onNavigate('orders')}
            className="p-3 rounded bg-rose-50/60 border border-rose-200/80 cursor-pointer hover:bg-rose-50 transition-colors"
          >
            <div className="flex items-center gap-2 text-rose-700 mb-1">
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="text-[11px] font-semibold">Refus / Retours</span>
            </div>
            <div className="text-xl font-bold text-rose-900">{metrics.refused + metrics.returned}</div>
          </div>
        </div>
      </div>

      {/* Two columns: Governorates & Communication/Integrations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribution par Gouvernorat Tunisien */}
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-emerald-600" />
              <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
                Top Gouvernorats Tunisiens
              </h3>
            </div>
            <span className="text-[11px] text-slate-400">Total 24 régions</span>
          </div>

          {governorateStats.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">Aucune commande enregistrée pour le moment.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {governorateStats.map((g) => (
                <div key={g.governorate} className="py-2.5 flex items-center justify-between text-xs">
                  <div className="font-medium text-slate-800">{g.governorate}</div>
                  <div className="flex items-center gap-4 text-slate-600">
                    <span>
                      <strong className="text-slate-900">{g.order_count}</strong> commande{g.order_count > 1 ? 's' : ''}
                    </span>
                    <span className="font-semibold text-emerald-700">{g.total_amount.toLocaleString('fr-TN')} DT</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* WhatsApp & Integrations Status */}
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs space-y-5">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
                Communication Client & Tâches
              </h3>
              <button
                onClick={() => onNavigate('inbox')}
                className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
              >
                Ouvrir la boîte
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div
                onClick={() => onNavigate('inbox')}
                className="p-3 rounded border border-slate-200 bg-slate-50 cursor-pointer hover:border-slate-300"
              >
                <div className="flex items-center gap-1.5 text-slate-500 mb-1">
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span className="text-xs">Conversations ouvertes</span>
                </div>
                <div className="text-lg font-bold text-slate-800">{metrics.openConversations}</div>
                {metrics.unreadMessages > 0 && (
                  <span className="text-[10px] text-emerald-600 font-medium">
                    {metrics.unreadMessages} non lu(s)
                  </span>
                )}
              </div>

              <div
                onClick={() => onNavigate('customers')}
                className="p-3 rounded border border-slate-200 bg-slate-50 cursor-pointer hover:border-slate-300"
              >
                <div className="flex items-center gap-1.5 text-slate-500 mb-1">
                  <Users className="w-3.5 h-3.5" />
                  <span className="text-xs">Base Clients CRM</span>
                </div>
                <div className="text-lg font-bold text-slate-800">{metrics.customerCount}</div>
                <span className="text-[10px] text-slate-400">Numéros normalisés (+216)</span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wider mb-3">
              État des Passerelles Connectées
            </h4>
            <div className="space-y-2">
              {integrations.map((i) => (
                <div
                  key={i.type}
                  className="flex items-center justify-between p-2.5 rounded border border-slate-100 bg-slate-50/50 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        i.status === 'connected' ? 'bg-emerald-500' : 'bg-slate-300'
                      }`}
                    />
                    <span className="font-medium text-slate-700">{i.name}</span>
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                      i.status === 'connected'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {i.status === 'connected' ? 'Actif & Synchronisé' : 'Non configuré'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
