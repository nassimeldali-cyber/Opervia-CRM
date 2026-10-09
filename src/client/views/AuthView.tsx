import React, { useState } from 'react';
import { api, User, Company } from '../api';
import { ShieldCheck, Check, ArrowRight } from 'lucide-react';

interface AuthViewProps {
  onLoginSuccess: (user: User, companies: Company[], activeCompany: Company | null) => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onLoginSuccess }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        const res = await api.post('/api/auth/login', { email, password });
        api.setToken(res.token);
        if (res.activeCompany) {
          api.setActiveTenantId(res.activeCompany.id);
        }
        onLoginSuccess(res.user, res.companies, res.activeCompany);
      } else {
        const res = await api.post('/api/auth/register', {
          email,
          password,
          full_name: fullName,
          company_name: companyName,
        });
        api.setToken(res.token);
        if (res.companyId) {
          api.setActiveTenantId(res.companyId);
        }
        // Fetch fresh me
        const me = await api.get('/api/auth/me');
        onLoginSuccess(me.user, me.companies, me.companies[0] || null);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoLogin = async (type: 'demo' | 'superadmin') => {
    setError(null);
    setLoading(true);
    try {
      const demoEmail = type === 'superadmin' ? 'superadmin@opervia.io' : 'demo@opervia.io';
      const demoPassword = 'OperviaAdmin2026!';
      const res = await api.post('/api/auth/login', { email: demoEmail, password: demoPassword });
      api.setToken(res.token);
      if (res.activeCompany) {
        api.setActiveTenantId(res.activeCompany.id);
      }
      onLoginSuccess(res.user, res.companies, res.activeCompany);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Brand header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white font-bold text-2xl mx-auto flex items-center justify-center shadow-lg">
            O
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Opervia CRM</h1>
          <p className="text-xs text-slate-400">
            Plateforme E-Commerce, WhatsApp Cloud API & Commandes COD
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-xl shadow-2xl p-6 sm:p-8 space-y-5">
          {/* Mode Tabs */}
          <div className="flex bg-slate-100 p-1 rounded-lg text-xs font-semibold">
            <button
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`flex-1 py-1.5 rounded-md transition-colors ${
                mode === 'login' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Connexion
            </button>
            <button
              onClick={() => {
                setMode('register');
                setError(null);
              }}
              className={`flex-1 py-1.5 rounded-md transition-colors ${
                mode === 'register' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Créer une entreprise
            </button>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
            {mode === 'register' && (
              <>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Nom et Prénom</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="ex. Sarra Ben Mahmoud"
                    className="w-full px-3 py-2 border border-slate-200 rounded focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">Nom de votre entreprise e-commerce</label>
                  <input
                    type="text"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="ex. Dar El Caftan Tunisie"
                    className="w-full px-3 py-2 border border-slate-200 rounded focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-slate-700 font-medium mb-1">Adresse e-mail</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="votre.email@boutique.tn"
                className="w-full px-3 py-2 border border-slate-200 rounded focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">Mot de passe</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 border border-slate-200 rounded focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-semibold transition-colors shadow-xs"
            >
              {loading
                ? 'Traitement...'
                : mode === 'login'
                ? 'Se connecter à l\'espace de travail'
                : 'Démarrer l\'essai gratuit 14 jours'}
            </button>
          </form>

          {/* Quick Demo Environment Buttons */}
          <div className="pt-4 border-t border-slate-100 space-y-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block text-center">
              Environnement de Démonstration Réaliste
            </span>

            <button
              type="button"
              onClick={() => handleQuickDemoLogin('demo')}
              className="w-full py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <span>Accéder à la démo : Dar El Caftan (Boutique Tunisie)</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            </button>

            <button
              type="button"
              onClick={() => handleQuickDemoLogin('superadmin')}
              className="w-full py-1.5 text-slate-500 hover:text-slate-800 text-[11px] font-medium text-center block"
            >
              Accès SuperAdmin Plateforme (superadmin@opervia.io)
            </button>
          </div>
        </div>

        <p className="text-[11px] text-slate-500 text-center">
          Opervia E-Commerce CRM · Conforme INPDP & Protection des Données Clients
        </p>
      </div>
    </div>
  );
};
