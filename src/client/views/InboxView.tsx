import React, { useEffect, useState } from 'react';
import {
  MessageSquare,
  Search,
  Send,
  Phone,
  User,
  MapPin,
  Package,
  Check,
  CheckCheck,
  Clock,
  AlertCircle,
  FileText,
  RefreshCw,
  Plus,
} from 'lucide-react';
import { api } from '../api';

interface Conversation {
  id: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  customer_norm_phone: string;
  governorate?: string;
  channel: string;
  status: 'open' | 'pending' | 'resolved';
  last_message_text: string;
  last_message_at: string;
  unread_count: number;
  priority: string;
}

interface Message {
  id: string;
  sender_type: 'customer' | 'agent' | 'system' | 'automation';
  sender_name?: string;
  text: string;
  status: 'queued' | 'sent' | 'delivered' | 'read' | 'failed';
  error_reason?: string;
  created_at: string;
}

interface WhatsAppTemplate {
  id: string;
  name: string;
  category: string;
  body: string;
}

export const InboxView: React.FC<{ onOpenNewOrder?: () => void }> = ({ onOpenNewOrder }) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [customer, setCustomer] = useState<any | null>(null);
  const [relatedOrders, setRelatedOrders] = useState<any[]>([]);
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);

  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [notice, setNotice] = useState<string | null>(null);

  const fetchConversations = async () => {
    try {
      const res = await api.get<{ conversations: Conversation[] }>(`/api/conversations?status=${statusFilter}`);
      setConversations(res.conversations);
      if (res.conversations.length > 0 && !activeConvId) {
        setActiveConvId(res.conversations[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (convId: string) => {
    try {
      const res = await api.get<{
        conversation: any;
        customer: any;
        orders: any[];
        messages: Message[];
      }>(`/api/conversations/${convId}/messages`);
      setMessages(res.messages);
      setCustomer(res.customer);
      setRelatedOrders(res.orders || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchTemplates = async () => {
    try {
      const res = await api.get<{ templates: WhatsAppTemplate[] }>('/api/whatsapp/templates');
      setTemplates(res.templates);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchConversations();
    fetchTemplates();
  }, [statusFilter]);

  useEffect(() => {
    if (activeConvId) {
      fetchMessages(activeConvId);
    }
  }, [activeConvId]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() && !selectedTemplateId) return;
    if (!activeConvId) return;

    try {
      setSending(true);
      setNotice(null);
      const res = await api.post(`/api/conversations/${activeConvId}/messages`, {
        text: replyText.trim(),
        template_id: selectedTemplateId || undefined,
      });

      if (res.notice) {
        setNotice(res.notice);
      }

      setReplyText('');
      setSelectedTemplateId('');
      fetchMessages(activeConvId);
      fetchConversations();
    } catch (err: any) {
      alert(`Erreur d'envoi : ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  const handleTemplateSelect = (tmplId: string) => {
    setSelectedTemplateId(tmplId);
    const tmpl = templates.find((t) => t.id === tmplId);
    if (tmpl) {
      setReplyText(tmpl.body);
    }
  };

  const activeConv = conversations.find((c) => c.id === activeConvId);

  return (
    <div className="h-[calc(100vh-3.5rem)] flex overflow-hidden bg-white">
      {/* Col 1: Conversation List */}
      <div className="w-80 border-r border-slate-200 flex flex-col shrink-0">
        <div className="p-3 border-b border-slate-200 space-y-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher conversation..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-2.5 py-1 text-xs rounded border border-slate-200"
            />
          </div>

          <div className="flex gap-1 text-[11px]">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2 py-0.5 rounded font-medium ${
                statusFilter === 'all' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Tous
            </button>
            <button
              onClick={() => setStatusFilter('open')}
              className={`px-2 py-0.5 rounded font-medium ${
                statusFilter === 'open' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Ouvert
            </button>
            <button
              onClick={() => setStatusFilter('resolved')}
              className={`px-2 py-0.5 rounded font-medium ${
                statusFilter === 'resolved' ? 'bg-slate-700 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Résolu
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {conversations.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">Aucune conversation</div>
          ) : (
            conversations.map((c) => {
              const isActive = c.id === activeConvId;
              return (
                <div
                  key={c.id}
                  onClick={() => setActiveConvId(c.id)}
                  className={`p-3.5 cursor-pointer transition-colors ${
                    isActive ? 'bg-emerald-50/60 border-l-3 border-emerald-600' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-xs text-slate-900 truncate">{c.customer_name}</span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(c.last_message_at).toLocaleTimeString('fr-TN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <p className="truncate text-[11px] pr-2">{c.last_message_text || 'Nouvelle conversation'}</p>
                    {c.unread_count > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full bg-emerald-600 text-white text-[10px] font-bold shrink-0">
                        {c.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Col 2: Chat Stream & Message Composer */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50/50">
        {activeConv ? (
          <>
            {/* Chat Header */}
            <div className="h-14 bg-white border-b border-slate-200 px-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
                  {activeConv.customer_name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900">{activeConv.customer_name}</h3>
                  <div className="flex items-center gap-2 text-[10px] text-slate-500">
                    <span>{activeConv.customer_phone}</span>
                    <span>·</span>
                    <span className="text-emerald-700 font-medium">WhatsApp Cloud API</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => api.patch(`/api/conversations/${activeConv.id}/status`, { status: activeConv.status === 'resolved' ? 'open' : 'resolved' }).then(fetchConversations)}
                  className="px-2.5 py-1 text-xs font-medium border border-slate-200 rounded hover:bg-slate-50 text-slate-700"
                >
                  {activeConv.status === 'resolved' ? 'Rouvrir' : 'Marquer comme Résolu'}
                </button>
              </div>
            </div>

            {/* Notice if queued pending credentials */}
            {notice && (
              <div className="bg-amber-50 border-b border-amber-200 p-2.5 px-4 text-xs text-amber-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>{notice}</span>
              </div>
            )}

            {/* Chat Messages */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3">
              {messages.map((m) => {
                const isCustomer = m.sender_type === 'customer';
                return (
                  <div
                    key={m.id}
                    className={`flex flex-col ${isCustomer ? 'items-start' : 'items-end'}`}
                  >
                    <div
                      className={`max-w-md px-3.5 py-2.5 rounded-lg text-xs shadow-2xs space-y-1 ${
                        isCustomer
                          ? 'bg-white text-slate-800 border border-slate-200'
                          : 'bg-emerald-600 text-white'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{m.text}</p>
                      <div
                        className={`text-[9px] flex items-center justify-end gap-1 ${
                          isCustomer ? 'text-slate-400' : 'text-emerald-100'
                        }`}
                      >
                        <span>
                          {new Date(m.created_at).toLocaleTimeString('fr-TN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {!isCustomer && (
                          <span>
                            {m.status === 'read' ? (
                              <CheckCheck className="w-3 h-3 text-cyan-200" />
                            ) : m.status === 'delivered' ? (
                              <CheckCheck className="w-3 h-3" />
                            ) : m.status === 'sent' ? (
                              <Check className="w-3 h-3" />
                            ) : (
                              <Clock className="w-3 h-3" />
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Message Input & Template Picker */}
            <div className="p-3 bg-white border-t border-slate-200 space-y-2">
              {/* Approved WhatsApp Templates Quick Picker */}
              {templates.length > 0 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
                  <span className="text-[10px] text-slate-400 font-bold uppercase shrink-0">Modèles Meta :</span>
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handleTemplateSelect(t.id)}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium border shrink-0 ${
                        selectedTemplateId === t.id
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              )}

              <form onSubmit={handleSendMessage} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Écrivez une réponse officielle WhatsApp..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded focus:ring-1 focus:ring-emerald-500"
                />
                <button
                  type="submit"
                  disabled={sending || (!replyText.trim() && !selectedTemplateId)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded text-xs font-medium flex items-center gap-1.5 shadow-xs"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Envoyer</span>
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-xs text-slate-400">
            Sélectionnez une conversation
          </div>
        )}
      </div>

      {/* Col 3: Customer Profile & Order History Drawer */}
      {customer && (
        <div className="w-72 border-l border-slate-200 p-4 space-y-4 shrink-0 overflow-y-auto bg-white">
          <div className="text-center space-y-1 pb-3 border-b border-slate-100">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-700 mx-auto flex items-center justify-center font-bold text-sm">
              {customer.full_name.slice(0, 2).toUpperCase()}
            </div>
            <h4 className="font-bold text-xs text-slate-900">{customer.full_name}</h4>
            <p className="text-[11px] text-slate-500">{customer.phone_normalized}</p>
          </div>

          <div className="space-y-2 text-xs">
            <span className="text-[10px] uppercase font-bold text-slate-400">Coordonnées</span>
            <div className="p-2.5 bg-slate-50 rounded border border-slate-100 space-y-1">
              <div className="flex items-center gap-1 text-slate-700">
                <MapPin className="w-3 h-3 text-emerald-600" />
                <span className="font-medium">{customer.governorate || 'Tunis'}</span>
              </div>
              <p className="text-[11px] text-slate-500">{customer.address || 'Adresse non renseignée'}</p>
            </div>
          </div>

          <div className="space-y-2 text-xs">
            <span className="text-[10px] uppercase font-bold text-slate-400">Statistiques d'achat</span>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="p-2 bg-slate-50 rounded border border-slate-100">
                <div className="text-sm font-bold text-slate-900">{customer.total_orders || 0}</div>
                <div className="text-[10px] text-slate-500">Commandes</div>
              </div>
              <div className="p-2 bg-slate-50 rounded border border-slate-100">
                <div className="text-sm font-bold text-emerald-700">{customer.total_spent_tnd || 0} DT</div>
                <div className="text-[10px] text-slate-500">Dépensé</div>
              </div>
            </div>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-slate-400">Commandes Récentes</span>
              {onOpenNewOrder && (
                <button
                  onClick={onOpenNewOrder}
                  className="text-[10px] text-emerald-600 hover:text-emerald-700 font-semibold flex items-center gap-0.5"
                >
                  <Plus className="w-3 h-3" />
                  <span>Créer</span>
                </button>
              )}
            </div>
            <div className="space-y-1.5">
              {relatedOrders.map((o) => (
                <div key={o.id} className="p-2 border border-slate-200 rounded text-[11px] space-y-0.5">
                  <div className="flex justify-between font-bold text-slate-800">
                    <span>{o.external_id || o.id}</span>
                    <span className="text-emerald-700">{o.total_tnd} DT</span>
                  </div>
                  <div className="text-[10px] text-slate-400 flex justify-between">
                    <span>{o.status}</span>
                    <span>{new Date(o.created_at).toLocaleDateString('fr-TN')}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
