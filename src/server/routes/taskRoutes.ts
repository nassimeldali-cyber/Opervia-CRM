import { Router, Response } from 'express';
import crypto from 'crypto';
import { execute, query, queryOne } from '../db/database.js';
import { requireAuth, requireTenant, AuthenticatedRequest } from '../auth/middleware.js';

const router = Router();

// GET /api/tasks
router.get('/', requireAuth, requireTenant, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status } = req.query;
    let sql = `
      SELECT t.*, u.full_name as assigned_to_name, o.id as order_id, o.customer_name
      FROM tasks t
      LEFT JOIN users u ON u.id = t.assigned_to_user_id
      LEFT JOIN orders o ON o.id = t.related_order_id
      WHERE t.company_id = ?
    `;
    const params: any[] = [req.tenantId];

    if (status && status !== 'all') {
      sql += ' AND t.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY CASE t.priority WHEN "high" THEN 1 WHEN "medium" THEN 2 ELSE 3 END, t.created_at DESC';
    const tasks = query(sql, params);
    res.json({ tasks });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tasks
router.post('/', requireAuth, requireTenant, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { title, description, assigned_to_user_id, related_order_id, priority = 'medium', due_date } = req.body;
    if (!title) {
      res.status(400).json({ error: 'Titre de la tâche requis.' });
      return;
    }

    const taskId = 'tsk_' + crypto.randomBytes(6).toString('hex');
    execute(
      `INSERT INTO tasks (id, company_id, title, description, assigned_to_user_id, related_order_id, priority, due_date, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [taskId, req.tenantId, title.trim(), description || null, assigned_to_user_id || null, related_order_id || null, priority, due_date || null]
    );

    res.status(201).json({ message: 'Tâche créée avec succès', taskId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/tasks/:id/toggle
router.patch('/:id/toggle', requireAuth, requireTenant, (req: AuthenticatedRequest, res: Response) => {
  try {
    const task = queryOne<{ id: string; status: string }>('SELECT id, status FROM tasks WHERE id = ? AND company_id = ?', [req.params.id, req.tenantId]);
    if (!task) {
      res.status(404).json({ error: 'Tâche introuvable' });
      return;
    }

    const nextStatus = task.status === 'completed' ? 'pending' : 'completed';
    execute('UPDATE tasks SET status = ? WHERE id = ?', [nextStatus, req.params.id]);
    res.json({ message: 'Statut de la tâche mis à jour', status: nextStatus });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/tasks/:id
router.delete('/:id', requireAuth, requireTenant, (req: AuthenticatedRequest, res: Response) => {
  try {
    execute('DELETE FROM tasks WHERE id = ? AND company_id = ?', [req.params.id, req.tenantId]);
    res.json({ message: 'Tâche supprimée' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
