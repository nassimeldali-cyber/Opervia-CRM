import React, { useEffect, useState } from 'react';
import {
  Package,
  Search,
  Filter,
  Download,
  Upload,
  Plus,
  RefreshCw,
  Phone,
  MapPin,
  Clock,
  CheckCircle,
  Truck,
  RotateCcw,
  Printer,
  ChevronRight,
  Eye,
  AlertCircle,
} from 'lucide-react';
import { api } from '../api';
import { ORDER_STATUSES, ORDER_STATUS_LABELS, OrderStatus, TUNISIAN_GOVERNORATES } from '../../server/constants';

interface OrderItem {
  id: string;
  product_name: string;
  sku: string;
  quantity: number;
  unit_price_tnd: number;
  total_price_tnd: number;
}

interface OrderHistory {
  id: string;
  from_status: string;
  to_status: string;
  user_name?: string;
  reason?: string;
  created_at: string;
}

interface Order {
  id: string;
  external_id?: string;
  source_channel: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  governorate: string;
  city?: string;
  address: string;
  products_summary?: string;
  cod_amount_tnd: number;
  subtotal_tnd: number;
  shipping_tnd: number;
  discount_tnd: number;
  total_tnd: number;
  status: OrderStatus;
  payment_method: string;
  payment_status: string;
  delivery_carrier?: string;
  tracking_number?: string;
  customer_notes?: string;
  internal_notes?: string;
  created_at: string;
  confirmed_at?: string;
  shipped_at?: string;
  delivered_at?: string;
}

export const OrdersView: React.FC<{ initialCreateModalOpen?: boolean; onCloseCreateModal?: () => void }> = ({
  initialCreateModalOpen = false,
  onCloseCreateModal,
}) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [govFilter, setGovFilter] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');

  // Selection for bulk actions
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);

  // Modals & Drawers
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderDetails, setOrderDetails] = useState<{ order: Order; items: OrderItem[]; history: OrderHistory[] } | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(initialCreateModalOpen);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isSlipModalOpen, setIsSlipModalOpen] = useState(false);

  // Create Order Form State
  const [newOrderForm, setNewOrderForm] = useState({
    customer_name: '',
    customer_phone: '',
    governorate: 'Tunis',
    city: '',
    address: '',
    product_name: '',
    product_price: 50,
    quantity: 1,
    shipping_tnd: 7.0,
    customer_notes: '',
  });

  // Import CSV State
  const [csvText, setCsvText] = useState('');
  const [importResult, setImportResult] = useState<any | null>(null);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (govFilter !== 'all') params.append('governorate', govFilter);
      if (search) params.append('search', search);

      const res = await api.get<{ orders: Order[]; total: number }>(`/api/orders?${params.toString()}`);
      setOrders(res.orders);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [statusFilter, govFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchOrders();
  };

  const handleSelectOrder = async (order: Order) => {
    setSelectedOrder(order);
    try {
      const res = await api.get<{ order: Order; items: OrderItem[]; history: OrderHistory[] }>(`/api/orders/${order.id}`);
      setOrderDetails(res);
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateStatus = async (orderId: string, nextStatus: OrderStatus) => {
    try {
      await api.patch(`/api/orders/${orderId}/status`, { status: nextStatus });
      fetchOrders();
      if (selectedOrder?.id === orderId) {
        handleSelectOrder({ ...selectedOrder, status: nextStatus });
      }
    } catch (err: any) {
      alert(`Erreur de transition : ${err.message}`);
    }
  };

  const handleBulkStatusChange = async (targetStatus: OrderStatus) => {
    if (selectedOrderIds.length === 0) return;
    try {
      await api.post('/api/orders/bulk-status', {
        orderIds: selectedOrderIds,
        status: targetStatus,
      });
      setSelectedOrderIds([]);
      fetchOrders();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/api/orders', {
        customer_name: newOrderForm.customer_name,
        customer_phone: newOrderForm.customer_phone,
        governorate: newOrderForm.governorate,
        city: newOrderForm.city,
        address: newOrderForm.address,
        items: [
          {
            product_name: newOrderForm.product_name || 'Article standard',
            quantity: Number(newOrderForm.quantity),
            unit_price_tnd: Number(newOrderForm.product_price),
          },
        ],
        shipping_tnd: Number(newOrderForm.shipping_tnd),
        customer_notes: newOrderForm.customer_notes,
      });

      setIsCreateModalOpen(false);
      if (onCloseCreateModal) onCloseCreateModal();
      fetchOrders();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleImportCsv = async () => {
    if (!csvText.trim()) return;
    try {
      const res = await api.post('/api/orders/import/csv', { csvText });
      setImportResult(res);
      fetchOrders();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <form onSubmit={handleSearchSubmit} className="relative w-72">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher par nom, tél, réf..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded border border-slate-200 bg-white focus:outline-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </form>

          {/* Governorate Dropdown */}
          <select
            value={govFilter}
            onChange={(e) => setGovFilter(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded border border-slate-200 bg-white font-medium text-slate-700"
          >
            <option value="all">Tous les gouvernorats</option>
            {TUNISIAN_GOVERNORATES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          {/* Toggle Table / Kanban */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded border border-slate-200 text-xs">
            <button
              onClick={() => setViewMode('table')}
              className={`px-2.5 py-1 rounded transition-colors font-medium ${
                viewMode === 'table' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tableau
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`px-2.5 py-1 rounded transition-colors font-medium ${
                viewMode === 'kanban' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Pipeline
            </button>
          </div>

          {/* Export CSV */}
          <a
            href="/api/orders/export/csv"
            download
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 hover:border-slate-300 bg-white text-slate-700 rounded text-xs font-medium"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exporter</span>
          </a>

          {/* Import CSV */}
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 hover:border-slate-300 bg-white text-slate-700 rounded text-xs font-medium"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Importer</span>
          </button>

          {/* New Order */}
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-medium shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nouvelle Commande</span>
          </button>
        </div>
      </div>

      {/* Status Tabs Filter */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs border-b border-slate-200">
        <button
          onClick={() => setStatusFilter('all')}
          className={`px-3 py-1.5 rounded-t font-medium transition-colors ${
            statusFilter === 'all'
              ? 'border-b-2 border-emerald-600 text-emerald-700 font-semibold'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          Toutes ({orders.length})
        </button>
        {ORDER_STATUSES.map((st) => {
          const cfg = ORDER_STATUS_LABELS[st];
          const count = orders.filter((o) => o.status === st).length;
          return (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-t font-medium whitespace-nowrap transition-colors ${
                statusFilter === st
                  ? 'border-b-2 border-emerald-600 text-emerald-700 font-semibold'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {cfg.fr} {count > 0 && `(${count})`}
            </button>
          );
        })}
      </div>

      {/* Bulk Action Toolbar if rows selected */}
      {selectedOrderIds.length > 0 && (
        <div className="bg-slate-900 text-white px-4 py-2.5 rounded-lg flex items-center justify-between text-xs shadow-md animate-fade-in">
          <span>{selectedOrderIds.length} commande(s) sélectionnée(s)</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleBulkStatusChange('confirmed')}
              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 rounded text-white font-medium"
            >
              Confirmer
            </button>
            <button
              onClick={() => handleBulkStatusChange('preparing')}
              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 rounded text-white font-medium"
            >
              En préparation
            </button>
            <button
              onClick={() => handleBulkStatusChange('shipped')}
              className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-700 rounded text-white font-medium"
            >
              Expédier
            </button>
            <button
              onClick={() => setSelectedOrderIds([])}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 font-medium"
            >
              Désélectionner
            </button>
          </div>
        </div>
      )}

      {/* Main View: Table or Kanban */}
      {loading ? (
        <div className="p-12 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
          <RefreshCw className="w-5 h-5 animate-spin text-emerald-600" />
          <span>Chargement des commandes...</span>
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-lg border border-slate-200 p-12 text-center space-y-3">
          <Package className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-sm font-semibold text-slate-700">Aucune commande trouvée</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Aucune commande ne correspond aux filtres sélectionnés. Créez une commande manuellement ou synchronisez votre boutique.
          </p>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-medium inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Ajouter une commande</span>
          </button>
        </div>
      ) : viewMode === 'table' ? (
        /* Table View */
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="p-3 w-8">
                  <input
                    type="checkbox"
                    checked={selectedOrderIds.length === orders.length && orders.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedOrderIds(orders.map((o) => o.id));
                      else setSelectedOrderIds([]);
                    }}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                </th>
                <th className="p-3">Référence / Date</th>
                <th className="p-3">Client & Téléphone</th>
                <th className="p-3">Gouvernorat / Adresse</th>
                <th className="p-3">Articles</th>
                <th className="p-3">Montant COD (DT)</th>
                <th className="p-3">Statut</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map((order) => {
                const statusConfig = ORDER_STATUS_LABELS[order.status];
                const isSelected = selectedOrderIds.includes(order.id);
                return (
                  <tr
                    key={order.id}
                    className={`hover:bg-slate-50/80 transition-colors ${isSelected ? 'bg-emerald-50/40' : ''}`}
                  >
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedOrderIds([...selectedOrderIds, order.id]);
                          else setSelectedOrderIds(selectedOrderIds.filter((id) => id !== order.id));
                        }}
                        className="rounded text-emerald-600 focus:ring-emerald-500"
                      />
                    </td>
                    <td className="p-3">
                      <div className="font-semibold text-slate-800">{order.external_id || order.id}</div>
                      <div className="text-[10px] text-slate-400">
                        {new Date(order.created_at).toLocaleDateString('fr-TN', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="font-medium text-slate-800">{order.customer_name}</div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span>{order.customer_phone}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="font-medium text-slate-800 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-emerald-600" />
                        <span>{order.governorate}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 truncate max-w-[180px]">{order.address}</div>
                    </td>
                    <td className="p-3">
                      <div className="truncate max-w-[200px] text-slate-700" title={order.products_summary}>
                        {order.products_summary || 'Articles variés'}
                      </div>
                    </td>
                    <td className="p-3 font-semibold text-slate-900">
                      {order.total_tnd.toFixed(2)} DT
                      <div className="text-[10px] font-normal text-slate-400">Livraison : {order.shipping_tnd} DT</div>
                    </td>
                    <td className="p-3">
                      <span className={`inline-block px-2.5 py-1 rounded text-[11px] font-semibold border ${statusConfig.color}`}>
                        {statusConfig.fr}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => handleSelectOrder(order)}
                        className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-slate-100 rounded transition-colors"
                        title="Détails & statut"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* Kanban Pipeline View */
        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-3.5 overflow-x-auto pb-4">
          {(['to_confirm', 'confirmed', 'preparing', 'shipped', 'delivered', 'refused'] as OrderStatus[]).map((st) => {
            const stCfg = ORDER_STATUS_LABELS[st];
            const columnOrders = orders.filter((o) => o.status === st);
            return (
              <div key={st} className="bg-slate-50 rounded-lg p-3 border border-slate-200 min-w-[210px] flex flex-col">
                <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-slate-200">
                  <span className="text-xs font-semibold text-slate-800">{stCfg.fr}</span>
                  <span className="text-[11px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded-full font-bold">
                    {columnOrders.length}
                  </span>
                </div>

                <div className="space-y-2 flex-1 overflow-y-auto max-h-[600px]">
                  {columnOrders.map((o) => (
                    <div
                      key={o.id}
                      onClick={() => handleSelectOrder(o)}
                      className="bg-white p-2.5 rounded border border-slate-200 shadow-2xs hover:border-emerald-400 cursor-pointer space-y-1.5 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-800">{o.external_id || o.id}</span>
                        <span className="text-xs font-semibold text-emerald-700">{o.total_tnd} DT</span>
                      </div>
                      <p className="text-xs font-medium text-slate-800 truncate">{o.customer_name}</p>
                      <div className="text-[10px] text-slate-500 flex items-center justify-between">
                        <span>{o.governorate}</span>
                        <span>{o.customer_phone}</span>
                      </div>
                    </div>
                  ))}
                  {columnOrders.length === 0 && (
                    <p className="text-[11px] text-slate-400 text-center py-6 italic">Vide</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Order Detail Drawer */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-2xs flex justify-end z-50 animate-fade-in">
          <div className="bg-white w-full max-w-lg h-full overflow-y-auto p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Commande {selectedOrder.external_id || selectedOrder.id}
                </h3>
                <p className="text-xs text-slate-400">
                  Enregistrée le {new Date(selectedOrder.created_at).toLocaleString('fr-TN')}
                </p>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold px-2"
              >
                ×
              </button>
            </div>

            {/* Status Change Selector */}
            <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-2">
              <label className="text-xs font-semibold text-slate-700 block">Changer le statut :</label>
              <div className="flex items-center gap-2">
                <select
                  value={selectedOrder.status}
                  onChange={(e) => handleUpdateStatus(selectedOrder.id, e.target.value as OrderStatus)}
                  className="flex-1 text-xs px-3 py-1.5 rounded border border-slate-300 bg-white font-medium text-slate-800"
                >
                  {ORDER_STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {ORDER_STATUS_LABELS[st].fr}
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => setIsSlipModalOpen(true)}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded text-xs font-medium flex items-center gap-1.5"
                  title="Imprimer bordereau COD"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Bordereau</span>
                </button>
              </div>
            </div>

            {/* Client Info */}
            <div className="space-y-2 text-xs">
              <h4 className="font-semibold text-slate-800 uppercase tracking-wider text-[11px]">Destinataire</h4>
              <div className="p-3 bg-slate-50 rounded border border-slate-200 space-y-1">
                <div className="font-bold text-slate-900 text-sm">{selectedOrder.customer_name}</div>
                <div className="flex items-center gap-1.5 text-slate-600">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-medium">{selectedOrder.customer_phone}</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-600">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>
                    {selectedOrder.governorate}, {selectedOrder.city || ''} — {selectedOrder.address}
                  </span>
                </div>
              </div>
            </div>

            {/* Financial Summary */}
            <div className="space-y-2 text-xs">
              <h4 className="font-semibold text-slate-800 uppercase tracking-wider text-[11px]">Règlement (Paiement COD)</h4>
              <div className="p-3 bg-slate-50 rounded border border-slate-200 space-y-1.5">
                <div className="flex justify-between">
                  <span>Sous-total articles :</span>
                  <span className="font-medium">{selectedOrder.subtotal_tnd.toFixed(2)} DT</span>
                </div>
                <div className="flex justify-between">
                  <span>Frais de livraison :</span>
                  <span className="font-medium">{selectedOrder.shipping_tnd.toFixed(2)} DT</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-slate-900 pt-1.5 border-t border-slate-200">
                  <span>Montant Total COD :</span>
                  <span className="text-emerald-700">{selectedOrder.total_tnd.toFixed(2)} DT</span>
                </div>
              </div>
            </div>

            {/* Timeline History */}
            {orderDetails?.history && orderDetails.history.length > 0 && (
              <div className="space-y-2 text-xs">
                <h4 className="font-semibold text-slate-800 uppercase tracking-wider text-[11px]">Historique d'audit</h4>
                <div className="divide-y divide-slate-100 border border-slate-100 rounded">
                  {orderDetails.history.map((h) => (
                    <div key={h.id} className="p-2.5 text-[11px] space-y-0.5">
                      <div className="font-medium text-slate-800 flex items-center justify-between">
                        <span>
                          {ORDER_STATUS_LABELS[h.to_status as OrderStatus]?.fr || h.to_status}
                        </span>
                        <span className="text-slate-400 text-[10px]">
                          {new Date(h.created_at).toLocaleTimeString('fr-TN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-slate-500">{h.reason || 'Action utilisateur'}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Manual Order Creation Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-2xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-lg max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-bold text-slate-900 text-sm">Nouvelle Commande Manuelle (Tunisie COD)</h3>
              <button
                onClick={() => {
                  setIsCreateModalOpen(false);
                  if (onCloseCreateModal) onCloseCreateModal();
                }}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateOrderSubmit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Nom complet du client *</label>
                  <input
                    type="text"
                    required
                    value={newOrderForm.customer_name}
                    onChange={(e) => setNewOrderForm({ ...newOrderForm, customer_name: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded focus:ring-1 focus:ring-emerald-500"
                    placeholder="ex. Mohamed Ali"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Téléphone (8 chiffres) *</label>
                  <input
                    type="text"
                    required
                    value={newOrderForm.customer_phone}
                    onChange={(e) => setNewOrderForm({ ...newOrderForm, customer_phone: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded focus:ring-1 focus:ring-emerald-500"
                    placeholder="ex. 98123456 ou 20123456"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Gouvernorat *</label>
                  <select
                    value={newOrderForm.governorate}
                    onChange={(e) => setNewOrderForm({ ...newOrderForm, governorate: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded bg-white"
                  >
                    {TUNISIAN_GOVERNORATES.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Ville / Délégation</label>
                  <input
                    type="text"
                    value={newOrderForm.city}
                    onChange={(e) => setNewOrderForm({ ...newOrderForm, city: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded"
                    placeholder="ex. Ariana Ville"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Adresse complète de livraison *</label>
                <input
                  type="text"
                  required
                  value={newOrderForm.address}
                  onChange={(e) => setNewOrderForm({ ...newOrderForm, address: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded"
                  placeholder="Rue, numéro, repère..."
                />
              </div>

              <div className="p-3 bg-slate-50 rounded border border-slate-200 space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="block text-slate-600 font-medium mb-1">Article</label>
                    <input
                      type="text"
                      required
                      value={newOrderForm.product_name}
                      onChange={(e) => setNewOrderForm({ ...newOrderForm, product_name: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded bg-white"
                      placeholder="Nom de l'article"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Prix unitaire (DT)</label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      value={newOrderForm.product_price}
                      onChange={(e) => setNewOrderForm({ ...newOrderForm, product_price: Number(e.target.value) })}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded bg-white"
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center text-xs pt-2 border-t border-slate-200">
                  <span className="text-slate-600">Frais de livraison standard :</span>
                  <span className="font-semibold">{newOrderForm.shipping_tnd} DT</span>
                </div>
                <div className="flex justify-between items-center text-xs font-bold text-slate-900">
                  <span>Total à encaisser à la livraison (COD) :</span>
                  <span className="text-emerald-700">
                    {(Number(newOrderForm.product_price) + Number(newOrderForm.shipping_tnd)).toFixed(2)} DT
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    if (onCloseCreateModal) onCloseCreateModal();
                  }}
                  className="px-3 py-1.5 border border-slate-200 rounded text-slate-600 hover:bg-slate-50 font-medium"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-medium shadow-xs"
                >
                  Créer la commande
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-2xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-lg max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-bold text-slate-900 text-sm">Importer des commandes depuis un fichier CSV</h3>
              <button onClick={() => setIsImportModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-lg font-bold">
                ×
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Collez vos données CSV avec les colonnes suivantes : <code>nom, telephone, gouvernorat, adresse, articles, total</code>.
            </p>

            <textarea
              rows={6}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder="nom,telephone,gouvernorat,adresse,articles,total&#10;Ines Riahi,98112233,Tunis,10 Rue Lafayette,Robe Soirée,140"
              className="w-full p-2.5 text-xs font-mono border border-slate-200 rounded"
            />

            {importResult && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800 space-y-1">
                <p className="font-bold">{importResult.message}</p>
                {importResult.invalidCount > 0 && (
                  <p className="text-rose-700">
                    {importResult.invalidCount} ligne(s) invalide(s) ignorée(s).
                  </p>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="px-3 py-1.5 border border-slate-200 rounded text-slate-600 hover:bg-slate-50 text-xs font-medium"
              >
                Fermer
              </button>
              <button
                type="button"
                onClick={handleImportCsv}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-medium"
              >
                Lancer l'importation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bordereau COD Modal (Delivery Slip) */}
      {isSlipModalOpen && selectedOrder && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-2xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-lg max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-300">
            <div className="flex items-center justify-between border-b pb-2">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Bordereau d'Expédition COD</h3>
                <p className="text-[10px] text-slate-500">Opervia Logistics Express · Tunisie</p>
              </div>
              <button onClick={() => setIsSlipModalOpen(false)} className="text-slate-400 font-bold text-lg">
                ×
              </button>
            </div>

            <div className="border border-slate-300 p-4 rounded space-y-3 text-xs bg-slate-50">
              <div className="flex justify-between items-center border-b pb-2">
                <span className="font-bold text-slate-900">Réf : {selectedOrder.external_id || selectedOrder.id}</span>
                <span className="px-2 py-0.5 bg-slate-900 text-white font-mono text-[10px] font-bold rounded">
                  PAIEMENT À LA LIVRAISON (COD)
                </span>
              </div>

              <div>
                <span className="text-slate-500 text-[10px] uppercase font-bold">Destinataire :</span>
                <p className="font-bold text-slate-900 text-sm">{selectedOrder.customer_name}</p>
                <p className="font-mono text-emerald-800 font-bold">{selectedOrder.customer_phone}</p>
                <p className="text-slate-700">
                  {selectedOrder.governorate} — {selectedOrder.address}
                </p>
              </div>

              <div className="border-t pt-2">
                <span className="text-slate-500 text-[10px] uppercase font-bold">Contenu du Colis :</span>
                <p className="text-slate-800 font-medium">{selectedOrder.products_summary || '1x Commande E-commerce'}</p>
              </div>

              <div className="border-t pt-2 flex justify-between items-center text-sm font-bold bg-white p-2.5 rounded border border-slate-200">
                <span className="text-slate-900">MONTANT À ENCAISSER :</span>
                <span className="text-base text-rose-700">{selectedOrder.total_tnd.toFixed(2)} DT</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => window.print()}
                className="px-3 py-1.5 bg-slate-900 hover:bg-black text-white text-xs font-medium rounded flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Imprimer le bon</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
