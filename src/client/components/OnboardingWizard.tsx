import React, { useState } from 'react';
import { CheckCircle2, Circle, ArrowRight, X, Building, ShoppingBag, MessageSquare, Users, Sparkles } from 'lucide-react';
import { NavTab } from './Sidebar';

interface OnboardingWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: NavTab) => void;
}

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ isOpen, onClose, onNavigate }) => {
  const [completedSteps, setCompletedSteps] = useState<number[]>([1, 2, 3, 4]);

  if (!isOpen) return null;

  const steps = [
    {
      num: 1,
      title: 'Création du compte utilisateur',
      desc: 'Compte administrateur sécurisé et vérifié.',
      tab: 'settings' as NavTab,
    },
    {
      num: 2,
      title: 'Configuration de l\'entreprise',
      desc: 'Pays: Tunisie, Devise: TND, Fuseau horaire: Tunis (GMT+1).',
      tab: 'settings' as NavTab,
    },
    {
      num: 3,
      title: 'Modèle commercial & Volume',
      desc: 'Paiement à la livraison (COD) configuré par défaut.',
      tab: 'settings' as NavTab,
    },
    {
      num: 4,
      title: 'Workflow des statuts de commande',
      desc: 'Nouveau > À confirmer > Confirmée > Préparation > Expédiée > Livrée / Refusée.',
      tab: 'orders' as NavTab,
    },
    {
      num: 5,
      title: 'Connecter WooCommerce ou Importer un CSV',
      desc: 'Synchronisez vos commandes web automatiquement.',
      tab: 'integrations' as NavTab,
    },
    {
      num: 6,
      title: 'Connecter Meta WhatsApp Cloud API',
      desc: 'Configurez la passerelle officielle pour les confirmations automatiques.',
      tab: 'integrations' as NavTab,
    },
    {
      num: 7,
      title: 'Inviter l\'équipe de téléopérateurs',
      desc: 'Ajoutez vos agents de confirmation et gestionnaires de livraison.',
      tab: 'team' as NavTab,
    },
    {
      num: 8,
      title: 'Activer votre première automatisation COD',
      desc: 'Envoyez un message WhatsApp lors d\'une nouvelle commande.',
      tab: 'automations' as NavTab,
    },
  ];

  const toggleStep = (num: number) => {
    if (completedSteps.includes(num)) {
      setCompletedSteps(completedSteps.filter((s) => s !== num));
    } else {
      setCompletedSteps([...completedSteps, num]);
    }
  };

  const progressPercent = Math.round((completedSteps.length / steps.length) * 100);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-2xs flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-xl max-w-xl w-full p-6 space-y-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-sm text-slate-900">Guide de Démarrage & Onboarding Opervia</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold text-lg">
            ×
          </button>
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-semibold text-slate-700">
            <span>Progression de l'installation</span>
            <span className="text-emerald-700">{progressPercent}% terminé</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div
              className="bg-emerald-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Steps List */}
        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
          {steps.map((st) => {
            const isDone = completedSteps.includes(st.num);
            return (
              <div
                key={st.num}
                className={`p-3 rounded-lg border text-xs flex items-center justify-between transition-colors ${
                  isDone ? 'bg-emerald-50/40 border-emerald-200' : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleStep(st.num)}
                    className="text-emerald-600 hover:opacity-80 transition-opacity"
                  >
                    {isDone ? (
                      <CheckCircle2 className="w-5 h-5 fill-emerald-600 text-white" />
                    ) : (
                      <Circle className="w-5 h-5 text-slate-300" />
                    )}
                  </button>
                  <div>
                    <h4 className={`font-semibold ${isDone ? 'line-through text-slate-500' : 'text-slate-900'}`}>
                      {st.title}
                    </h4>
                    <p className="text-[11px] text-slate-500">{st.desc}</p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    onNavigate(st.tab);
                    onClose();
                  }}
                  className="text-slate-400 hover:text-emerald-700 p-1"
                  title="Accéder au module"
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>

        <div className="flex justify-end pt-2 border-t border-slate-100">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-black text-white text-xs font-semibold rounded shadow-xs"
          >
            Fermer le guide
          </button>
        </div>
      </div>
    </div>
  );
};
