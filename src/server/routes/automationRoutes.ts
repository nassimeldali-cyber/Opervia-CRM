import { Router, Response } from 'express';
import crypto from 'crypto';
import { execute, query, queryOne } from '../db/database.js';
import { requireAuth, requireTenant, AuthenticatedRequest } from '../auth/middleware.js';

const router = Router();

// GET /api/automations
router.get('/', requireAuth, requireTenant, (req: AuthenticatedRequest, res: Response) => {
  try {
    const rules = query(
      'SELECT * FROM automation_rules WHERE company_id = ? ORDER BY created_at DESC',
      [req.tenantId]
    );

    const executions = query(
      `SELECT e.*, r.name as rule_name
       FROM automation_executions e
       JOIN automation_rules r ON r.id = e.rule_id
       WHERE e.company_id = ?
       ORDER BY e.created_at DESC LIMIT 30`,
      [req.tenantId]
    );

    res.json({ rules, executions });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/automations
router.post('/', requireAuth, requireTenant, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, trigger_type, conditions, actions } = req.body;
    if (!name || !trigger_type || !actions || actions.length === 0) {
      res.status(400).json({ error: 'Nom, déclencheur et actions requis pour créer une règle.' });
      return;
    }

    const ruleId = 'rule_' + crypto.randomBytes(6).toString('hex');
    execute(
      `INSERT INTO automation_rules (id, company_id, name, trigger_type, conditions_json, actions_json, enabled)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [ruleId, req.tenantId, name.trim(), trigger_type, JSON.stringify(conditions || []), JSON.stringify(actions)]
    );

    res.status(201).json({ message: "Règle d'automatisation créée avec succès", ruleId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/automations/:id/toggle
router.patch('/:id/toggle', requireAuth, requireTenant, (req: AuthenticatedRequest, res: Response) => {
  try {
    const rule = queryOne<{ id: string; enabled: number }>('SELECT id, enabled FROM automation_rules WHERE id = ? AND company_id = ?', [req.params.id, req.tenantId]);
    if (!rule) {
      res.status(404).json({ error: 'Règle introuvable' });
      return;
    }

    const newEnabled = rule.enabled === 1 ? 0 : 1;
    execute('UPDATE automation_rules SET enabled = ? WHERE id = ?', [newEnabled, req.params.id]);
    res.json({ message: `Règle ${newEnabled === 1 ? 'activée' : 'désactivée'}`, enabled: newEnabled === 1 });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/automations/:id
router.delete('/:id', requireAuth, requireTenant, (req: AuthenticatedRequest, res: Response) => {
  try {
    execute('DELETE FROM automation_rules WHERE id = ? AND company_id = ?', [req.params.id, req.tenantId]);
    res.json({ message: 'Règle supprimée' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
