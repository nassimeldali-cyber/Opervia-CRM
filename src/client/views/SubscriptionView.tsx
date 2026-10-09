import React, { useEffect, useState } from 'react';
import { CreditCard, Check, ShieldCheck, Clock, Building, AlertCircle } from 'lucide-react';
import { api } from '../api';
import { SUBSCRIPTION_PLANS } from '../../server/constants';

export const SubscriptionView: React.FC = () => {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [selectedPlanSlug, setSelectedPlanSlug] = useState('pro_quarterly');
  const [receiptRef, setReceiptRef] = useState('');
  const [receiptNote, setReceiptNote] = useState('');

  const fetchSubscription = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/billing/current');
      setData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscription();
  }, []);

  const handleSubmitReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const plan = SUBSCRIPTION_PLANS.find((p) => p.slug === selectedPlanSlug);
      await api.post('/api/billing/submit-receipt', {
        plan_id: `plan_${selectedPlanSlug}`,
        receipt_reference: receiptRef,
        receipt_note: receiptNote,
      });

      setIsReceiptModalOpen(false);
      setReceiptRef('');
      setReceiptNote('');
      alert('Justificatif de virement enregistré avec succès. Activation dès validation administrative.');
      fetchSubscription();
    } catch (err: any) {
      alert(`Erreur : ${err.message}`);
    }
  };

  if (loading || !data) {
    return <div className="p-8 text-center text-xs text-slate-400">Chargement de l'abonnement...</div>;
  }

  const { subscription, invoices, usage } = data;

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      <div>
        <h2 className="text-sm font-bold text-slate-900">Abonnement & Facturation Opervia</h2>
        <p className="text-xs text-slate-500">
          Gérez votre formule SaaS, vos limites de volume et vos justificatifs de paiement bancaire.
        </p>
      </div>

      {/* Active Subscription Banner */}
      <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-bold text-base text-slate-900">{subscription?.plan_name || 'Formule Active'}</span>
            <span
              className={`px-2.5 py-0.5 rounded text-[11px] font-bold uppercase ${
                subscription?.status === 'active'
                  ? 'bg-emerald-100 text-emerald-800'
                  : subscription?.status === 'trial'
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-rose-100 text-rose-800'
              }`}
            >
              {subscription?.status === 'trial' ? 'Période d\'essai gratuite' : subscription?.status}
            </span>
          </div>

          <p className="text-xs text-slate-500">
            Période valide jusqu'au :{' '}
            <strong className="text-slate-800">
              {subscription?.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString('fr-TN') : 'N/A'}
            </strong>
          </p>
        </div>

        <button
          onClick={() => setIsReceiptModalOpen(true)}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold shadow-xs"
        >
          Renouveler ou changer de forfait
        </button>
      </div>

      {/* Pricing Cards Grid */}
      <div>
        <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wider mb-4">
          Forfaits Disponibles (Tarification E-commerce)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {SUBSCRIPTION_PLANS.map((plan) => {
            const isCurrent = subscription?.plan_slug === plan.slug;
            return (
              <div
                key={plan.slug}
                className={`bg-white rounded-lg p-5 border space-y-4 flex flex-col justify-between ${
                  isCurrent ? 'border-emerald-500 ring-2 ring-emerald-500/20 shadow-sm' : 'border-slate-200'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm text-slate-900">{plan.name}</h4>
                    {isCurrent && (
                      <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                        Actuel
                      </span>
                    )}
                  </div>

                  <div>
                    <div className="text-2xl font-extrabold text-slate-900">
                      {plan.priceEur} €{' '}
                      <span className="text-xs font-normal text-slate-500">
                        (~{plan.priceTnd} DT)
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Facturation {plan.billingCycleMonths === 1 ? 'mensuelle' : `par ${plan.billingCycleMonths} mois`}
                    </p>
                  </div>

                  <ul className="text-xs space-y-1.5 text-slate-600 pt-2 border-t border-slate-100">
                    {plan.features.map((feat, i) => (
                      <li key={i} className="flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  onClick={() => {
                    setSelectedPlanSlug(plan.slug);
                    setIsReceiptModalOpen(true);
                  }}
                  className={`w-full py-2 rounded text-xs font-semibold transition-colors ${
                    isCurrent
                      ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  {isCurrent ? 'Renouveler ce forfait' : 'Choisir ce forfait'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Invoices List */}
      <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-3">
        <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
          Historique des Règlements & Factures
        </h3>

        <div className="divide-y divide-slate-100">
          {invoices.length === 0 ? (
            <p className="text-xs text-slate-400 py-3">Aucun règlement enregistré.</p>
          ) : (
            invoices.map((inv: any) => (
              <div key={inv.id} className="py-2.5 text-xs flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-800">{inv.id}</span>
                  <span className="text-slate-500 ml-2">
                    · Réf: {inv.receipt_reference || 'N/A'} ({inv.payment_method})
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-slate-900">{inv.amount_eur} € ({inv.amount_tnd} DT)</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                      inv.status === 'paid'
                        ? 'bg-emerald-50 text-emerald-700'
                        : inv.status === 'pending_verification'
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-rose-50 text-rose-700'
                    }`}
                  >
                    {inv.status === 'paid'
                      ? 'Payé & Confirmé'
                      : inv.status === 'pending_verification'
                      ? 'En vérification comptable'
                      : 'Échoué'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Manual Bank Payment Modal */}
      {isReceiptModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-2xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-lg max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-slate-900 text-sm">Règlement par Virement Bancaire (Tunisie & International)</h3>
              <button onClick={() => setIsReceiptModalOpen(false)} className="text-slate-400 font-bold text-lg">
                ×
              </button>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded text-xs space-y-1">
              <p className="font-bold text-slate-800">Coordonnées Bancaires Opervia SARL :</p>
              <p className="text-slate-600">Banque : BIAT ou Attijari Bank Tunisie</p>
              <p className="font-mono text-slate-900 font-bold">RIB : 08 000 0000000000000 00</p>
              <p className="text-[10px] text-slate-500">Paiement D17 / Flouci également accepté sur demande.</p>
            </div>

            <form onSubmit={handleSubmitReceipt} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Forfait sélectionné</label>
                <select
                  value={selectedPlanSlug}
                  onChange={(e) => setSelectedPlanSlug(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded bg-white"
                >
                  {SUBSCRIPTION_PLANS.map((p) => (
                    <option key={p.slug} value={p.slug}>
                      {p.name} — {p.priceEur} € (~{p.priceTnd} DT)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Numéro de référence de la transaction / Reçu bancaire *</label>
                <input
                  type="text"
                  required
                  value={receiptRef}
                  onChange={(e) => setReceiptRef(e.target.value)}
                  placeholder="ex. VIR-BIAT-998811"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Notes ou agence émettrice</label>
                <input
                  type="text"
                  value={receiptNote}
                  onChange={(e) => setReceiptNote(e.target.value)}
                  placeholder="ex. Virement exécuté depuis le compte de la société"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsReceiptModalOpen(false)}
                  className="px-3 py-1.5 border border-slate-200 rounded text-slate-600"
                >
                  Annuler
                </button>
                <button type="submit" className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-medium">
                  Transmettre le justificatif
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
