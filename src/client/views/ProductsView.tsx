import React, { useEffect, useState } from 'react';
import { ShoppingBag, Search, Plus, Trash2, Edit2, CheckCircle2, XCircle } from 'lucide-react';
import { api } from '../api';

interface Product {
  id: string;
  sku: string;
  name: string;
  description?: string;
  price_tnd: number;
  cost_tnd: number;
  stock_quantity: number;
  track_inventory: number;
  is_active: number;
}

export const ProductsView: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const [form, setForm] = useState({
    sku: '',
    name: '',
    description: '',
    price_tnd: 50,
    cost_tnd: 25,
    stock_quantity: 20,
  });

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res = await api.get<{ products: Product[] }>(`/api/products${search ? `?search=${search}` : ''}`);
      setProducts(res.products);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/api/products', form);
      setIsAddModalOpen(false);
      setForm({ sku: '', name: '', description: '', price_tnd: 50, cost_tnd: 25, stock_quantity: 20 });
      fetchProducts();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce produit du catalogue ?')) return;
    try {
      await api.delete(`/api/products/${id}`);
      fetchProducts();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="relative w-72">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher produit ou SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchProducts()}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded border border-slate-200 bg-white"
          />
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-medium shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Ajouter un produit</span>
        </button>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
        <table className="w-full text-left text-xs text-slate-600">
          <thead className="bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
            <tr>
              <th className="p-3">SKU</th>
              <th className="p-3">Produit</th>
              <th className="p-3">Prix de vente (DT)</th>
              <th className="p-3">Prix de revient (DT)</th>
              <th className="p-3">Marge unitaire</th>
              <th className="p-3">Stock disponible</th>
              <th className="p-3">Statut</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {products.map((p) => {
              const margin = p.price_tnd - p.cost_tnd;
              return (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="p-3 font-mono font-bold text-slate-800">{p.sku}</td>
                  <td className="p-3 font-semibold text-slate-900">{p.name}</td>
                  <td className="p-3 font-bold text-slate-900">{p.price_tnd.toFixed(2)} DT</td>
                  <td className="p-3 text-slate-500">{p.cost_tnd.toFixed(2)} DT</td>
                  <td className="p-3 font-semibold text-emerald-700">+{margin.toFixed(2)} DT</td>
                  <td className="p-3 font-bold text-slate-800">{p.stock_quantity} unités</td>
                  <td className="p-3">
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700">
                      Actif
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-2xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-lg max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-slate-900 text-sm">Ajouter un produit au catalogue</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 font-bold text-lg">
                ×
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Nom du produit *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded"
                  placeholder="ex. Jebba Tunisienne"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Code SKU</label>
                <input
                  type="text"
                  value={form.sku}
                  onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded"
                  placeholder="ex. JEB-MOD-01"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Prix Vente (DT)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={form.price_tnd}
                    onChange={(e) => setForm({ ...form, price_tnd: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Prix Coût (DT)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={form.cost_tnd}
                    onChange={(e) => setForm({ ...form, cost_tnd: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Stock Initial</label>
                  <input
                    type="number"
                    value={form.stock_quantity}
                    onChange={(e) => setForm({ ...form, stock_quantity: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded"
                  />
                </div>
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
                  Créer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
