import React, { useEffect, useState } from 'react';
import {
  Users,
  Search,
  Phone,
  MapPin,
  Plus,
  GitMerge,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  Download,
  AlertTriangle,
} from 'lucide-react';
import { api } from '../api';
import { TUNISIAN_GOVERNORATES } from '../../server/constants';

interface Customer {
  id: string;
  full_name: string;
  phone: string;
  phone_normalized: string;
  email?: string;
  governorate?: string;
  city?: string;
  address?: string;
  acquisition_channel: string;
  consent_status: 'opt_in' | 'opt_out' | 'pending';
  total_orders: number;
  total_spent_tnd: number;
  refused_orders_count: number;
  created_at: string;
}

export const CustomersView: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [govFilter, setGovFilter] = useState('all');
  const [consentFilter, setConsentFilter] = useState('all');

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Add form
  const [newCustomer, setNewCustomer] = useState({
    full_name: '',
    phone: '',
    email: '',
    governorate: 'Tunis',
    city: '',
    address: '',
    notes: '',
  });

  // Merge form
  const [mergePrimaryId, setMergePrimaryId] = useState('');
  const [mergeDuplicateId, setMergeDuplicateId] = useState('');

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (govFilter !== 'all') params.append('governorate', govFilter);
      if (consentFilter !== 'all') params.append('consent', consentFilter);

      const res = await api.get<{ customers: Customer[]; total: number }>(`/api/customers?${params.toString()}`);
      setCustomers(res.customers);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [govFilter, consentFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCustomers();
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/api/customers', newCustomer);
      setIsAddModalOpen(false);
      setNewCustomer({ full_name: '', phone: '', email: '', governorate: 'Tunis', city: '', address: '', notes: '' });
      fetchCustomers();
    } catch (err: any) {
      alert(`Erreur : ${err.message}`);
    }
  };

  const handleMergeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/api/customers/merge', {
        primaryCustomerId: mergePrimaryId,
        duplicateCustomerId: mergeDuplicateId,
      });
      setIsMergeModalOpen(false);
      fetchCustomers();
    } catch (err: any) {
      alert(`Erreur de fusion : ${err.message}`);
    }
  };

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <form onSubmit={handleSearchSubmit} className="relative w-72">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher par nom, téléphone (+216)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded border border-slate-200 bg-white"
            />
          </form>

          <select
            value={govFilter}
            onChange={(e) => setGovFilter(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded border border-slate-200 bg-white"
          >
            <option value="all">Tous les gouvernorats</option>
            {TUNISIAN_GOVERNORATES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>

          <select
            value={consentFilter}
            onChange={(e) => setConsentFilter(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded border border-slate-200 bg-white"
          >
            <option value="all">Tous consentements</option>
            <option value="opt_in">Opt-In (Eligible WhatsApp)</option>
            <option value="opt_out">Opt-Out (Refus messages)</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMergeModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 hover:border-slate-300 bg-white text-slate-700 rounded text-xs font-medium"
          >
            <GitMerge className="w-3.5 h-3.5" />
            <span>Fusionner doublons</span>
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-medium shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nouveau Client</span>
          </button>
        </div>
      </div>

      {/* Customer Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
        <table className="w-full text-left text-xs text-slate-600">
          <thead className="bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
            <tr>
              <th className="p-3">Client</th>
              <th className="p-3">Téléphone Normalisé</th>
              <th className="p-3">Gouvernorat</th>
              <th className="p-3">Commandes</th>
              <th className="p-3">Total Dépensé (DT)</th>
              <th className="p-3">Refus COD</th>
              <th className="p-3">Consentement</th>
              <th className="p-3">Canal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {customers.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                <td className="p-3">
                  <div className="font-semibold text-slate-800">{c.full_name}</div>
                  <div className="text-[10px] text-slate-400">{c.email || 'Sans email'}</div>
                </td>
                <td className="p-3 font-mono font-medium text-slate-800">
                  {c.phone_normalized || c.phone}
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-1 font-medium text-slate-700">
                    <MapPin className="w-3 h-3 text-emerald-600" />
                    <span>{c.governorate || 'Non renseigné'}</span>
                  </div>
                </td>
                <td className="p-3 font-semibold text-slate-900">{c.total_orders}</td>
                <td className="p-3 font-bold text-emerald-700">{c.total_spent_tnd.toFixed(2)} DT</td>
                <td className="p-3">
                  {c.refused_orders_count > 0 ? (
                    <span className="text-rose-600 font-bold flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>{c.refused_orders_count} refus</span>
                    </span>
                  ) : (
                    <span className="text-slate-400">0</span>
                  )}
                </td>
                <td className="p-3">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${
                      c.consent_status === 'opt_in'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-rose-50 text-rose-700'
                    }`}
                  >
                    {c.consent_status === 'opt_in' ? 'Opt-In' : 'Opt-Out (Stop)'}
                  </span>
                </td>
                <td className="p-3 capitalize text-slate-500">{c.acquisition_channel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Customer Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-2xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-lg max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-slate-900 text-sm">Ajouter un nouveau client</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 font-bold text-lg">
                ×
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Nom complet *</label>
                <input
                  type="text"
                  required
                  value={newCustomer.full_name}
                  onChange={(e) => setNewCustomer({ ...newCustomer, full_name: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded"
                  placeholder="ex. Sonia Trabelsi"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Téléphone tunisien (8 chiffres) *</label>
                <input
                  type="text"
                  required
                  value={newCustomer.phone}
                  onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded"
                  placeholder="ex. 98112233"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Gouvernorat</label>
                  <select
                    value={newCustomer.governorate}
                    onChange={(e) => setNewCustomer({ ...newCustomer, governorate: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded bg-white"
                  >
                    {TUNISIAN_GOVERNORATES.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Ville</label>
                  <input
                    type="text"
                    value={newCustomer.city}
                    onChange={(e) => setNewCustomer({ ...newCustomer, city: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded"
                    placeholder="Ville"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Adresse complète</label>
                <input
                  type="text"
                  value={newCustomer.address}
                  onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded"
                  placeholder="Adresse..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3 py-1.5 border border-slate-200 rounded text-slate-600"
                >
                  Annuler
                </button>
                <button type="submit" className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-medium">
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Safe Merge Modal */}
      {isMergeModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-2xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-lg max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-slate-900 text-sm">Fusionner deux fiches client (Anti-doublon)</h3>
              <button onClick={() => setIsMergeModalOpen(false)} className="text-slate-400 font-bold text-lg">
                ×
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Toutes les commandes et conversations du client doublon seront rattachées au client principal de manière sécurisée.
            </p>

            <form onSubmit={handleMergeSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Client Principal à conserver</label>
                <select
                  required
                  value={mergePrimaryId}
                  onChange={(e) => setMergePrimaryId(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded bg-white"
                >
                  <option value="">Sélectionner un client...</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name} ({c.phone_normalized})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Client Doublon à fusionner et supprimer</label>
                <select
                  required
                  value={mergeDuplicateId}
                  onChange={(e) => setMergeDuplicateId(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded bg-white"
                >
                  <option value="">Sélectionner le doublon...</option>
                  {customers
                    .filter((c) => c.id !== mergePrimaryId)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.full_name} ({c.phone_normalized})
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsMergeModalOpen(false)}
                  className="px-3 py-1.5 border border-slate-200 rounded text-slate-600"
                >
                  Annuler
                </button>
                <button type="submit" className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-medium">
                  Fusionner
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
