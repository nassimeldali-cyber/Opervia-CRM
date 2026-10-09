import React, { useEffect, useState } from 'react';
import { Zap, Plus, CheckCircle2, XCircle, Clock, Trash2, ArrowRight } from 'lucide-react';
import { api } from '../api';

interface AutomationRule {
  id: string;
  name: string;
  enabled: number;
  trigger_type: string;
  conditions_json: string;
  actions_json: string;
  execution_count: number;
  last_executed_at?: string;
}

interface AutomationExecution {
  id: string;
  rule_name: string;
  trigger_event: string;
  status: 'success' | 'failed';
  execution_log?: string;
  created_at: string;
}

export const AutomationsView: React.FC = () => {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [executions, setExecutions] = useState<AutomationExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // New Rule form
  const [ruleName, setRuleName] = useState('');
  const [triggerType, setTriggerType] = useState('order_created');
  const [actionType, setActionType] = useState('set_order_status');
  const [actionValue, setActionValue] = useState('to_confirm');

  const fetchAutomations = async () => {
    try {
      setLoading(true);
      const res = await api.get<{ rules: AutomationRule[]; executions: AutomationExecution[] }>('/api/automations');
      setRules(res.rules);
      setExecutions(res.executions);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAutomations();
  }, []);

  const handleToggle = async (id: string) => {
    try {
      await api.patch(`/api/automations/${id}/toggle`);
      fetchAutomations();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette règle ?')) return;
    try {
      await api.delete(`/api/automations/${id}`);
      fetchAutomations();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let actions: any[] = [];
      if (actionType === 'set_order_status') {
        actions.push({ type: 'set_order_status', status: actionValue });
      } else if (actionType === 'create_task') {
        actions.push({ type: 'create_task', title: 'Rappel téléphonique pour confirmation' });
      } else if (actionType === 'send_whatsapp_template') {
        actions.push({ type: 'send_whatsapp_template', template_id: 'tmpl_1' });
      }

      await api.post('/api/automations', {
        name: ruleName,
        trigger_type: triggerType,
        conditions: [],
        actions,
      });

      setIsModalOpen(false);
      setRuleName('');
      fetchAutomations();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Moteur d'Automatisations Opervia</h2>
          <p className="text-xs text-slate-500">
            Exécute des tâches en arrière-plan (confirmations, relances, alertes WhatsApp).
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-medium shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Créer une règle</span>
        </button>
      </div>

      {/* Rules list */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs divide-y divide-slate-100">
        {rules.map((rule) => {
          const isEnabled = rule.enabled === 1;
          const actions = JSON.parse(rule.actions_json || '[]');
          return (
            <div key={rule.id} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-xs text-slate-900">{rule.name}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-100 text-slate-600">
                    Déclencheur: {rule.trigger_type}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                  <span>Actions ({actions.length}) :</span>
                  {actions.map((a: any, idx: number) => (
                    <span key={idx} className="bg-emerald-50 text-emerald-800 px-1.5 py-0.2 rounded font-medium">
                      {a.type}
                    </span>
                  ))}
                  <span>· Exécutée {rule.execution_count} fois</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleToggle(rule.id)}
                  className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                    isEnabled ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {isEnabled ? 'Actif' : 'Désactivé'}
                </button>

                <button
                  onClick={() => handleDelete(rule.id)}
                  className="p-1 text-slate-400 hover:text-rose-600 rounded"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Execution logs */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-3">
        <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
          Journal des Dernières Exécutions
        </h3>
        <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
          {executions.length === 0 ? (
            <p className="text-xs text-slate-400 py-3">Aucune exécution enregistrée.</p>
          ) : (
            executions.map((ex) => (
              <div key={ex.id} className="py-2 text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="font-medium text-slate-800">{ex.rule_name}</span>
                  <span className="text-slate-400">({ex.trigger_event})</span>
                </div>
                <span className="text-[10px] text-slate-400">
                  {new Date(ex.created_at).toLocaleTimeString('fr-TN')}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* New Rule Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-2xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-lg max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-slate-900 text-sm">Nouvelle Règle d'Automatisation</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 font-bold text-lg">
                ×
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Nom de la règle</label>
                <input
                  type="text"
                  required
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded"
                  placeholder="ex. Auto-relance WhatsApp pour commande non confirmée"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Déclencheur</label>
                <select
                  value={triggerType}
                  onChange={(e) => setTriggerType(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded bg-white"
                >
                  <option value="order_created">À la réception d'une nouvelle commande</option>
                  <option value="order_status_changed">Au changement de statut d'une commande</option>
                  <option value="whatsapp_received">À la réception d'un message WhatsApp</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Action à exécuter</label>
                <select
                  value={actionType}
                  onChange={(e) => setActionType(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded bg-white"
                >
                  <option value="set_order_status">Définir le statut de la commande</option>
                  <option value="create_task">Créer une tâche pour l'équipe</option>
                  <option value="send_whatsapp_template">Envoyer un modèle WhatsApp</option>
                </select>
              </div>

              {actionType === 'set_order_status' && (
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Statut cible</label>
                  <select
                    value={actionValue}
                    onChange={(e) => setActionValue(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded bg-white"
                  >
                    <option value="to_confirm">À confirmer</option>
                    <option value="confirmed">Confirmée</option>
                    <option value="preparing">En préparation</option>
                  </select>
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
                  Créer la règle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
