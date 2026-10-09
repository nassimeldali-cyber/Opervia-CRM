import React, { useEffect, useState } from 'react';
import { Plug, CheckCircle2, Copy, Check, ExternalLink, RefreshCw, Key, Shield } from 'lucide-react';
import { api } from '../api';

export const IntegrationsView: React.FC = () => {
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // WooCommerce connection state
  const [wcSecret, setWcSecret] = useState('');
  const [wcModal, setWcModal] = useState(false);

  // WhatsApp connection state
  const [waModal, setWaModal] = useState(false);
  const [waConfig, setWaConfig] = useState({
    phoneNumberId: '',
    wabaId: '',
    accessToken: '',
    appSecret: '',
  });

  const tenantId = api.getActiveTenantId() || '';
  const baseUrl = window.location.origin;

  const fetchIntegrations = async () => {
    try {
      setLoading(true);
      const res = await api.get<{ integrations: any[] }>('/api/integrations');
      setIntegrations(res.integrations);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIntegrations();
  }, []);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSaveWc = async () => {
    try {
      await api.post('/api/integrations/connect', {
        type: 'woocommerce',
        name: 'Boutique WooCommerce',
        credentials: { secret: wcSecret },
      });
      setWcModal(false);
      fetchIntegrations();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSaveWa = async () => {
    try {
      await api.post('/api/integrations/connect', {
        type: 'whatsapp',
        name: 'Meta WhatsApp Cloud API',
        credentials: waConfig,
      });
      setWaModal(false);
      fetchIntegrations();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const wcIntegration = integrations.find((i) => i.type === 'woocommerce');
  const waIntegration = integrations.find((i) => i.type === 'whatsapp');
  const customIntegration = integrations.find((i) => i.type === 'custom_api');

  const wcWebhookUrl = `${baseUrl}/api/integrations/woocommerce/webhook?tenantId=${tenantId}`;
  const waWebhookUrl = `${baseUrl}/api/whatsapp/webhook?tenantId=${tenantId}`;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h2 className="text-sm font-bold text-slate-900">Passerelles & Connecteurs E-Commerce</h2>
        <p className="text-xs text-slate-500">
          Synchronisez automatiquement vos commandes, clients et conversations depuis vos boutiques en ligne.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* WooCommerce Card */}
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-sm">
                WC
              </div>
              <div>
                <h3 className="font-bold text-xs text-slate-900">WooCommerce / WordPress</h3>
                <p className="text-[11px] text-slate-500">Synchronisation bidirectionnelle & Webhooks COD</p>
              </div>
            </div>

            <span
              className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                wcIntegration?.status === 'connected' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {wcIntegration?.status === 'connected' ? 'Connecté' : 'Non configuré'}
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded border border-slate-100 space-y-2 text-xs">
            <div>
              <span className="text-[10px] text-slate-500 font-bold uppercase block">URL Webhook à renseigner dans WooCommerce :</span>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="text"
                  readOnly
                  value={wcWebhookUrl}
                  className="flex-1 font-mono text-[11px] px-2.5 py-1 bg-white border border-slate-200 rounded"
                />
                <button
                  onClick={() => handleCopy(wcWebhookUrl, 'wc_url')}
                  className="px-2.5 py-1 bg-slate-800 text-white rounded text-xs flex items-center gap-1 shrink-0"
                >
                  {copiedKey === 'wc_url' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>Copier</span>
                </button>
              </div>
            </div>

            <div className="text-[11px] text-slate-600 space-y-1 pt-2">
              <p className="font-semibold text-slate-800">Instructions WooCommerce :</p>
              <ol className="list-decimal pl-4 space-y-0.5">
                <li>Allez dans WooCommerce &gt; Réglages &gt; Avancé &gt; Webhooks</li>
                <li>Créez un webhook avec Sujet: <strong>Commande créée</strong> (order.created)</li>
                <li>Collez l'URL ci-dessus et activez le webhook</li>
              </ol>
            </div>
          </div>

          <button
            onClick={() => setWcModal(true)}
            className="w-full py-1.5 border border-slate-200 hover:bg-slate-50 rounded text-xs font-medium text-slate-700"
          >
            Configurer les clés API WooCommerce
          </button>
        </div>

        {/* Meta WhatsApp Cloud API Card */}
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm">
                WA
              </div>
              <div>
                <h3 className="font-bold text-xs text-slate-900">Meta WhatsApp Cloud API</h3>
                <p className="text-[11px] text-slate-500">Passerelle officielle WhatsApp Business Platform</p>
              </div>
            </div>

            <span
              className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                waIntegration?.status === 'connected' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {waIntegration?.status === 'connected' ? 'Connecté' : 'Non configuré'}
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded border border-slate-100 space-y-2 text-xs">
            <div>
              <span className="text-[10px] text-slate-500 font-bold uppercase block">URL de Rappel (Webhook Meta) :</span>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="text"
                  readOnly
                  value={waWebhookUrl}
                  className="flex-1 font-mono text-[11px] px-2.5 py-1 bg-white border border-slate-200 rounded"
                />
                <button
                  onClick={() => handleCopy(waWebhookUrl, 'wa_url')}
                  className="px-2.5 py-1 bg-slate-800 text-white rounded text-xs flex items-center gap-1 shrink-0"
                >
                  {copiedKey === 'wa_url' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>Copier</span>
                </button>
              </div>
            </div>

            <div>
              <span className="text-[10px] text-slate-500 font-bold uppercase block">Jeton de vérification (Verify Token) :</span>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="text"
                  readOnly
                  value="opervia_webhook_verify_token_sample"
                  className="flex-1 font-mono text-[11px] px-2.5 py-1 bg-white border border-slate-200 rounded"
                />
                <button
                  onClick={() => handleCopy('opervia_webhook_verify_token_sample', 'wa_tok')}
                  className="px-2.5 py-1 bg-slate-800 text-white rounded text-xs flex items-center gap-1 shrink-0"
                >
                  {copiedKey === 'wa_tok' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>Copier</span>
                </button>
              </div>
            </div>
          </div>

          <button
            onClick={() => setWaModal(true)}
            className="w-full py-1.5 border border-slate-200 hover:bg-slate-50 rounded text-xs font-medium text-slate-700"
          >
            Configurer les identifiants Meta Cloud API
          </button>
        </div>

        {/* Custom Website REST API */}
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
                API
              </div>
              <div>
                <h3 className="font-bold text-xs text-slate-900">Sites E-Commerce Sur-Mesure (REST API)</h3>
                <p className="text-[11px] text-slate-500">Laravel, Next.js, Django, Prestashop ou PHP natif</p>
              </div>
            </div>

            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700">
              Prêt à l'emploi
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded border border-slate-100 space-y-2 text-xs">
            <span className="text-[10px] text-slate-500 font-bold uppercase block">Endpoint POST :</span>
            <code className="block bg-slate-900 text-emerald-400 p-2 rounded text-[11px] font-mono">
              POST {baseUrl}/api/integrations/custom/orders
            </code>
            <p className="text-[11px] text-slate-600">
              Passez vos en-têtes <code>X-API-KEY: {customIntegration?.webhook_secret || 'votre_cle_api'}</code> et{' '}
              <code>X-Idempotency-Key</code> pour garantir l'unicité de chaque commande.
            </p>
          </div>
        </div>

        {/* Shopify Framework Card */}
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded bg-green-100 text-green-700 flex items-center justify-center font-bold text-sm">
                SH
              </div>
              <div>
                <h3 className="font-bold text-xs text-slate-900">Shopify App Connector</h3>
                <p className="text-[11px] text-slate-500">Connecteur officiel pour boutiques internationales</p>
              </div>
            </div>

            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600">
              En attente d'approbation d'app
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded border border-slate-100 text-xs text-slate-600 space-y-1">
            <p className="font-medium text-slate-800">État du connecteur :</p>
            <p className="text-[11px]">
              L'architecture backend et les gestionnaires de webhooks Shopify HMAC sont entièrement implémentés. La connexion requiert la publication de l'application sur le Shopify Partners Dashboard.
            </p>
          </div>
        </div>
      </div>

      {/* WooCommerce Config Modal */}
      {wcModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-2xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-lg max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-slate-900 text-sm">Identifiants WooCommerce</h3>
              <button onClick={() => setWcModal(false)} className="text-slate-400 font-bold text-lg">
                ×
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Secret Partagé Webhook WooCommerce</label>
                <input
                  type="text"
                  value={wcSecret}
                  onChange={(e) => setWcSecret(e.target.value)}
                  placeholder="ex. wc_secret_xyz123"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setWcModal(false)} className="px-3 py-1.5 border border-slate-200 rounded text-slate-600">
                  Annuler
                </button>
                <button onClick={handleSaveWc} className="px-4 py-1.5 bg-emerald-600 text-white rounded font-medium">
                  Enregistrer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Config Modal */}
      {waModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-2xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-lg max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-slate-900 text-sm">Identifiants Meta WhatsApp Cloud API</h3>
              <button onClick={() => setWaModal(false)} className="text-slate-400 font-bold text-lg">
                ×
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Phone Number ID (Meta Dashboard)</label>
                <input
                  type="text"
                  value={waConfig.phoneNumberId}
                  onChange={(e) => setWaConfig({ ...waConfig, phoneNumberId: e.target.value })}
                  placeholder="ex. 104829102938475"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">WhatsApp Business Account ID (WABA ID)</label>
                <input
                  type="text"
                  value={waConfig.wabaId}
                  onChange={(e) => setWaConfig({ ...waConfig, wabaId: e.target.value })}
                  placeholder="ex. 984729104820194"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Permanent System User Access Token</label>
                <input
                  type="password"
                  value={waConfig.accessToken}
                  onChange={(e) => setWaConfig({ ...waConfig, accessToken: e.target.value })}
                  placeholder="EAAB..."
                  className="w-full px-3 py-1.5 border border-slate-200 rounded font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setWaModal(false)} className="px-3 py-1.5 border border-slate-200 rounded text-slate-600">
                  Annuler
                </button>
                <button onClick={handleSaveWa} className="px-4 py-1.5 bg-emerald-600 text-white rounded font-medium">
                  Enregistrer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
