import React, { useEffect, useState } from 'react';
import { UserCheck, Plus, Shield, Mail } from 'lucide-react';
import { api } from '../api';

interface Member {
  membership_id: string;
  user_id: string;
  email: string;
  full_name: string;
  role: 'owner' | 'admin' | 'agent' | 'logistics';
  status: string;
  created_at: string;
}

export const TeamView: React.FC = () => {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [form, setForm] = useState({
    email: '',
    full_name: '',
    role: 'agent',
  });

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const res = await api.get<{ members: Member[] }>('/api/companies/team');
      setMembers(res.members);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/api/companies/team/invite', form);
      setIsModalOpen(false);
      setForm({ email: '', full_name: '', role: 'agent' });
      fetchMembers();
    } catch (err: any) {
      alert(`Erreur d'invitation : ${err.message}`);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Équipe & Rôles d'Accès (RBAC)</h2>
          <p className="text-xs text-slate-500">
            Gérez les collaborateurs, téléopérateurs de confirmation et gestionnaires de livraison.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-medium shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Inviter un collaborateur</span>
        </button>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
        <table className="w-full text-left text-xs text-slate-600">
          <thead className="bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
            <tr>
              <th className="p-3">Collaborateur</th>
              <th className="p-3">Email</th>
              <th className="p-3">Rôle & Permissions</th>
              <th className="p-3">Statut</th>
              <th className="p-3">Date d'ajout</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {members.map((m) => (
              <tr key={m.membership_id} className="hover:bg-slate-50">
                <td className="p-3 font-semibold text-slate-900">{m.full_name}</td>
                <td className="p-3 text-slate-600 font-mono text-[11px]">{m.email}</td>
                <td className="p-3">
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                      m.role === 'owner'
                        ? 'bg-purple-50 text-purple-700'
                        : m.role === 'admin'
                        ? 'bg-blue-50 text-blue-700'
                        : m.role === 'logistics'
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-emerald-50 text-emerald-700'
                    }`}
                  >
                    {m.role === 'owner'
                      ? 'Propriétaire'
                      : m.role === 'admin'
                      ? 'Administrateur'
                      : m.role === 'logistics'
                      ? 'Logistique / Livraisons'
                      : 'Agent Support & Vente'}
                  </span>
                </td>
                <td className="p-3">
                  <span className="text-emerald-700 font-medium">Actif</span>
                </td>
                <td className="p-3 text-slate-400 text-[11px]">
                  {new Date(m.created_at).toLocaleDateString('fr-TN')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-2xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-lg max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-slate-900 text-sm">Inviter un nouveau collaborateur</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 font-bold text-lg">
                ×
              </button>
            </div>

            <form onSubmit={handleInviteSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Nom complet *</label>
                <input
                  type="text"
                  required
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded"
                  placeholder="ex. Marwen Ben Salah"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Adresse e-mail professionnelle *</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded"
                  placeholder="collaborateur@entreprise.tn"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Rôle assigné</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded bg-white"
                >
                  <option value="agent">Agent Support & Confirmation téléphonique</option>
                  <option value="logistics">Gestionnaire Logistique & Expéditions</option>
                  <option value="admin">Administrateur</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 border border-slate-200 rounded text-slate-600"
                >
                  Annuler
                </button>
                <button type="submit" className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-medium">
                  Envoyer l'invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
