import React, { useEffect, useState } from 'react';
import { CheckSquare, Plus, Check, Clock, AlertTriangle, Trash2 } from 'lucide-react';
import { api } from '../api';

interface Task {
  id: string;
  title: string;
  description?: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'completed';
  due_date?: string;
  customer_name?: string;
  order_id?: string;
  assigned_to_name?: string;
  created_at: string;
}

export const TasksView: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'medium',
  });

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const res = await api.get<{ tasks: Task[] }>('/api/tasks');
      setTasks(res.tasks);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleToggle = async (id: string) => {
    try {
      await api.patch(`/api/tasks/${id}/toggle`);
      fetchTasks();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/api/tasks/${id}`);
      fetchTasks();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/api/tasks', form);
      setIsModalOpen(false);
      setForm({ title: '', description: '', priority: 'medium' });
      fetchTasks();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Tâches & Rappels de l'Équipe</h2>
          <p className="text-xs text-slate-500">
            Suivi des relances téléphoniques, vérifications d'adresses et colis bloqués.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-medium shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Nouvelle Tâche</span>
        </button>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs divide-y divide-slate-100">
        {tasks.map((t) => {
          const isDone = t.status === 'completed';
          return (
            <div key={t.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleToggle(t.id)}
                  className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                    isDone ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 hover:border-emerald-500'
                  }`}
                >
                  {isDone && <Check className="w-3.5 h-3.5" />}
                </button>

                <div className="space-y-0.5">
                  <span className={`text-xs font-semibold ${isDone ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                    {t.title}
                  </span>
                  {t.description && <p className="text-[11px] text-slate-500">{t.description}</p>}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    t.priority === 'high'
                      ? 'bg-rose-50 text-rose-700'
                      : t.priority === 'medium'
                      ? 'bg-amber-50 text-amber-700'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {t.priority}
                </span>

                <button onClick={() => handleDelete(t.id)} className="p-1 text-slate-400 hover:text-rose-600">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}

        {tasks.length === 0 && (
          <div className="p-8 text-center text-xs text-slate-400">Aucune tâche en attente. Bravo !</div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-2xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-lg max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-slate-900 text-sm">Ajouter une tâche</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 font-bold text-lg">
                ×
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Titre de la tâche</label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded"
                  placeholder="ex. Rappeler le client pour confirmation Nabeul"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Description / Notes</label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Priorité</label>
                <select
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value as any })}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded bg-white"
                >
                  <option value="low">Basse</option>
                  <option value="medium">Moyenne</option>
                  <option value="high">Haute / Urgente</option>
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
