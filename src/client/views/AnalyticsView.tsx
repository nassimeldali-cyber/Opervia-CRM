import React, { useEffect, useState } from 'react';
import { BarChart3, TrendingUp, AlertTriangle, MapPin, Download } from 'lucide-react';
import { api } from '../api';

export const AnalyticsView: React.FC = () => {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/api/reports/dashboard')
      .then((res) => setData(res))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) {
    return <div className="p-8 text-center text-xs text-slate-400">Chargement des analyses...</div>;
  }

  const { metrics, governorateStats, channelStats } = data;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Analyses des Ventes & Taux de Livraison (Tunisie)</h2>
          <p className="text-xs text-slate-500">
            Métriques certifiées extraites de la base de données tenant pour l'optimisation logistique COD.
          </p>
        </div>

        <a
          href="/api/orders/export/csv"
          download
          className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 rounded text-xs font-medium text-slate-700 shadow-2xs"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Exporter données brutes (CSV)</span>
        </a>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-lg border border-slate-200">
          <div className="text-xs text-slate-500 mb-1">Taux de Réussite de Livraison</div>
          <div className="text-3xl font-bold text-emerald-700">{metrics.deliverySuccessRate}%</div>
          <p className="text-[11px] text-slate-400 mt-1">Colis encaissés avec succès</p>
        </div>

        <div className="bg-white p-5 rounded-lg border border-slate-200">
          <div className="text-xs text-slate-500 mb-1">Taux de Refus Client à la Porte</div>
          <div className="text-3xl font-bold text-rose-600">{metrics.refusalRate}%</div>
          <p className="text-[11px] text-slate-400 mt-1">Client absent ou a refusé de payer</p>
        </div>

        <div className="bg-white p-5 rounded-lg border border-slate-200">
          <div className="text-xs text-slate-500 mb-1">Total Encaissé (DT)</div>
          <div className="text-3xl font-bold text-slate-900">{metrics.deliveredRevenueTnd.toFixed(2)} DT</div>
          <p className="text-[11px] text-slate-400 mt-1">Sur {metrics.totalRevenueTnd.toFixed(2)} DT commandés</p>
        </div>
      </div>

      {/* Breakdown by Governorate */}
      <div className="bg-white p-5 rounded-lg border border-slate-200 space-y-4">
        <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wider flex items-center gap-2">
          <MapPin className="w-4 h-4 text-emerald-600" />
          <span>Performance par Gouvernorat</span>
        </h3>

        <div className="divide-y divide-slate-100">
          {governorateStats.map((g: any) => (
            <div key={g.governorate} className="py-2.5 flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-800">{g.governorate}</span>
              <div className="flex items-center gap-6">
                <span className="text-slate-600">{g.order_count} commandes</span>
                <span className="font-bold text-emerald-700">{g.total_amount.toFixed(2)} DT</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
