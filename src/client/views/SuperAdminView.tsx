import React, { useEffect, useState } from 'react';
import { Shield, Building2, CheckCircle2, XCircle, AlertTriangle, Users, Package } from 'lucide-react';
import { api } from '../api';

export const SuperAdminView: React.FC = () => {
  const [metrics, setMetrics] = useState<any | null>(null);
  const [tenants, setTenants] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSuperAdminData = async () => {
    try {
      setLoading(true);
      const [m, t, inv] = await Promise.all([
        api.get('/api/superadmin/metrics'),
        api.get('/api/superadmin/tenants'),
        api.get('/api/superadmin/invoices'),
      ]);
      setMetrics(m.metrics);
      setTenants(t.tenants);
      setInvoices(inv.invoices);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuperAdminData();
  }, []);

  const handleToggleTenantStatus = async (tenantId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'active' ? 'suspended' : 'active';
    if (!confirm(`Voulez-vous vraiment changer le statut de cette entreprise vers "${nextStatus}" ?`)) return;
    try {
      await api.patch(`/api/superadmin/tenants/${tenantId}/status`, { status: nextStatus });
      fetchSuperAdminData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleApproveInvoice = async (invoiceId: string) => {
    if (!confirm('Valider la réception des fonds bancaires et activer le forfait ?')) return;
    try {
      await api.post('/api/billing/admin-approve', { invoiceId });
      alert('Paiement validé et forfait activé !');
      fetchSuperAdminData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) return <div className="p-8 text-center text-xs text-slate-400">Chargement console SuperAdmin...</div>;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h2 className="text-sm font-bold text-slate-900">Portail SuperAdmin Plateforme Opervia</h2>
        <p className="text-xs text-slate-500">
          Supervision globale des entreprises clientes, statut des abonnements et approbation des virements.
        </p>
      </div>

      {/* Metrics */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg border border-slate-200">
            <span className="text-xs text-slate-500">Total Entreprises</span>
            <div className="text-2xl font-bold text-slate-900">{metrics.totalTenants}</div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-slate-200">
            <span className="text-xs text-slate-500">Abonnements Actifs</span>
            <div className="text-2xl font-bold text-emerald-700">{metrics.activeSubscriptions}</div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-slate-200">
            <span className="text-xs text-slate-500">Total Commandes Plateforme</span>
            <div className="text-2xl font-bold text-slate-900">{metrics.totalOrders}</div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-slate-200">
            <span className="text-xs text-slate-500">Règlements en attente</span>
            <div className="text-2xl font-bold text-amber-600">{metrics.pendingInvoices}</div>
          </div>
        </div>
      )}

      {/* Pending Invoices for Approval */}
      {invoices.filter((i) => i.status === 'pending_verification').length > 0 && (
        <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-5 space-y-3">
          <h3 className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>Justificatifs de Virement en Attente de Validation</span>
          </h3>

          <div className="divide-y divide-amber-200/60 bg-white rounded border border-amber-200 overflow-hidden">
            {invoices
              .filter((i) => i.status === 'pending_verification')
              .map((inv) => (
                <div key={inv.id} className="p-3 text-xs flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-900">{inv.company_name}</span>
                    <span className="text-slate-500 ml-2">
                      Réf: {inv.receipt_reference} · {inv.amount_eur} € ({inv.amount_tnd} DT)
                    </span>
                    {inv.receipt_note && <p className="text-[11px] text-slate-600">{inv.receipt_note}</p>}
                  </div>

                  <button
                    onClick={() => handleApproveInvoice(inv.id)}
                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold"
                  >
                    Valider le virement
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Tenants Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-3.5 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-800">
          Liste des Entreprises Clientes (Tenants)
        </div>
        <table className="w-full text-left text-xs text-slate-600">
          <thead className="bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
            <tr>
              <th className="p-3">Entreprise</th>
              <th className="p-3">Propriétaire</th>
              <th className="p-3">Forfait</th>
              <th className="p-3">Statut Forfait</th>
              <th className="p-3">Commandes</th>
              <th className="p-3">Statut Entreprise</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tenants.map((t) => (
              <tr key={t.id} className="hover:bg-slate-50">
                <td className="p-3 font-semibold text-slate-900">{t.name}</td>
                <td className="p-3 text-slate-600">{t.owner_email || 'N/A'}</td>
                <td className="p-3 font-medium text-slate-800">{t.plan_name || 'Essai'}</td>
                <td className="p-3">
                  <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                    {t.subscription_status || 'Inconnu'}
                  </span>
                </td>
                <td className="p-3 font-bold text-slate-800">{t.order_count || 0}</td>
                <td className="p-3">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      t.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                    }`}
                  >
                    {t.status}
                  </span>
                </td>
                <td className="p-3 text-right">
                  <button
                    onClick={() => handleToggleTenantStatus(t.id, t.status)}
                    className={`px-2.5 py-1 rounded text-xs font-semibold ${
                      t.status === 'active'
                        ? 'text-rose-600 hover:bg-rose-50'
                        : 'text-emerald-700 hover:bg-emerald-50'
                    }`}
                  >
                    {t.status === 'active' ? 'Suspendre' : 'Réactiver'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
