import React, { useEffect, useState } from 'react';
import { Settings, Building, ShieldCheck, Save, Clock, Banknote } from 'lucide-react';
import { api } from '../api';

export const SettingsView: React.FC = () => {
  const [company, setCompany] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('TND');
  const [timezone, setTimezone] = useState('Africa/Tunis');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api
      .get('/api/companies/current')
      .then((res) => {
        setCompany(res.company);
        setName(res.company?.name || '');
        setCurrency(res.company?.currency || 'TND');
        setTimezone(res.company?.timezone || 'Africa/Tunis');
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.put('/api/companies/current', {
        name,
        currency,
        timezone,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) return <div className="p-8 text-center text-xs text-slate-400">Chargement...</div>;

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-sm font-bold text-slate-900">Paramètres de l'Entreprise</h2>
        <p className="text-xs text-slate-500">
          Identité commerciale, devise par défaut et politiques de conformité.
        </p>
      </div>

      <form onSubmit={handleSave} className="bg-white p-6 rounded-lg border border-slate-200 shadow-2xs space-y-5 text-xs">
        <div className="space-y-4">
          <div>
            <label className="block text-slate-700 font-medium mb-1">Raison sociale / Nom commercial</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-700 font-medium mb-1">Devise principale</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded bg-white"
              >
                <option value="TND">Dinar Tunisien (TND / DT)</option>
                <option value="EUR">Euro (€)</option>
                <option value="USD">Dollar Américain ($)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">Fuseau horaire</label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded bg-white"
              >
                <option value="Africa/Tunis">Tunis (GMT+1)</option>
                <option value="Europe/Paris">Paris (GMT+1/GMT+2)</option>
                <option value="UTC">UTC Standard</option>
              </select>
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded border border-slate-200 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-slate-900">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Conformité Protection des Données (INPDP / RGPD)</span>
            </div>
            <p className="text-[11px] text-slate-500">
              Opervia applique automatiquement le droit d'opposition et le désabonnement (opt-out) dès qu'un client répond STOP ou ARRÊT sur WhatsApp.
            </p>
          </div>
        </div>

        <div className="flex justify-end pt-3 border-t border-slate-100">
          <button
            type="submit"
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-medium flex items-center gap-1.5 shadow-xs"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saved ? 'Enregistré avec succès !' : 'Enregistrer les modifications'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
