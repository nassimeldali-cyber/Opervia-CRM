import React, { useEffect, useState } from 'react';
import { Send, Plus, Users, ShieldCheck, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { api } from '../api';
import { TUNISIAN_GOVERNORATES } from '../../server/constants';

interface Campaign {
  id: string;
  name: string;
  template_name: string;
  template_category: string;
  status: string;
  total_recipients: number;
  sent_count: number;
  delivered_count: number;
  failed_count: number;
  created_at: string;
}

interface WhatsAppTemplate {
  id: string;
  name: string;
  category: string;
  body: string;
}

export const CampaignsView: React.FC = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Wizard state
  const [name, setName] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [governorate, setGovernorate] = useState('all');
  const [audienceEstimate, setAudienceEstimate] = useState<any | null>(null);

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const res = await api.get<{ campaigns: Campaign[] }>('/api/campaigns');
      setCampaigns(res.campaigns);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const res = await api.get<{ templates: WhatsAppTemplate[] }>('/api/whatsapp/templates');
      setTemplates(res.templates);
      if (res.templates.length > 0 && !templateId) {
        setTemplateId(res.templates[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchCampaigns();
    fetchTemplates();
  }, []);

  // Update audience preview on filter change
  useEffect(() => {
    if (!isModalOpen) return;
    api
      .post('/api/campaigns/preview-audience', { governorate })
      .then((res) => setAudienceEstimate(res))
      .catch((err) => console.error(err));
  }, [governorate, isModalOpen]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post('/api/campaigns', {
        name,
        template_id: templateId,
        governorate,
      });

      // Prompt to launch
      if (confirm(`Campagne créée avec ${res.recipientCount} destinataires éligibles. Souhaitez-vous la lancer maintenant ?`)) {
        await api.post(`/api/campaigns/${res.campaignId}/launch`);
      }

      setIsModalOpen(false);
      setName('');
      fetchCampaigns();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleLaunchCampaign = async (id: string) => {
    try {
      await api.post(`/api/campaigns/${id}/launch`);
      alert('Campagne transmise en file d\'envoi avec succès.');
      fetchCampaigns();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Campagnes & Diffusions WhatsApp</h2>
          <p className="text-xs text-slate-500">
            Envoi de messages groupés via des modèles Meta officiels avec filtrage strict du consentement.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-medium shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Nouvelle Campagne</span>
        </button>
      </div>

      {/* Campaign Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {campaigns.map((c) => (
          <div key={c.id} className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-slate-900">{c.name}</span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                  c.status === 'sending'
                    ? 'bg-amber-100 text-amber-800'
                    : c.status === 'completed'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                {c.status}
              </span>
            </div>

            <div className="text-[11px] text-slate-500 space-y-1">
              <div>Modèle : {c.template_name}</div>
              <div className="flex justify-between">
                <span>Destinataires éligibles :</span>
                <span className="font-semibold text-slate-800">{c.total_recipients}</span>
              </div>
              <div className="flex justify-between">
                <span>Envoyés :</span>
                <span className="font-semibold text-emerald-700">{c.sent_count}</span>
              </div>
            </div>

            {c.status === 'draft' && (
              <button
                onClick={() => handleLaunchCampaign(c.id)}
                className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold"
              >
                Lancer la campagne
              </button>
            )}
          </div>
        ))}

        {campaigns.length === 0 && (
          <div className="col-span-3 bg-white p-10 rounded-lg border border-slate-200 text-center text-xs text-slate-400">
            Aucune campagne WhatsApp pour l'instant. Créez votre première campagne ciblée.
          </div>
        )}
      </div>

      {/* New Campaign Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-2xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-lg max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-slate-900 text-sm">Créer une campagne WhatsApp ciblée</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 font-bold text-lg">
                ×
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Nom de la campagne</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded"
                  placeholder="ex. Relance paniers abandonnés Grand Tunis"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Modèle Meta Approuvé</label>
                <select
                  required
                  value={templateId}
                  onChange={(e) => setTemplateId(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded bg-white"
                >
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.category})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Ciblage par Gouvernorat</label>
                <select
                  value={governorate}
                  onChange={(e) => setGovernorate(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded bg-white"
                >
                  <option value="all">Toute la Tunisie (24 gouvernorats)</option>
                  {TUNISIAN_GOVERNORATES.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>

              {/* Compliance & Audience Estimate Panel */}
              {audienceEstimate && (
                <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded space-y-1.5 text-emerald-900">
                  <div className="flex items-center gap-1.5 font-bold">
                    <ShieldCheck className="w-4 h-4 text-emerald-700" />
                    <span>Conformité & Estimation de l'Audience</span>
                  </div>
                  <div className="text-[11px] space-y-1 text-emerald-800">
                    <div className="flex justify-between">
                      <span>Candidats éligibles (Opt-In actif) :</span>
                      <strong className="text-slate-900">{audienceEstimate.eligibleRecipients} clients</strong>
                    </div>
                    {audienceEstimate.suppressedOptOut > 0 && (
                      <div className="flex justify-between text-rose-700">
                        <span>Exclus automatiquement (Désabonnement/Opt-Out) :</span>
                        <span>{audienceEstimate.suppressedOptOut} clients</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-1 border-t border-emerald-200">
                      <span>Coût estimé passerelle Meta :</span>
                      <strong>{audienceEstimate.estimatedCostEur} € (~{(audienceEstimate.estimatedCostEur * 3.4).toFixed(1)} DT)</strong>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 border border-slate-200 rounded text-slate-600"
                >
                  Annuler
                </button>
                <button type="submit" className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-medium">
                  Créer la campagne
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
