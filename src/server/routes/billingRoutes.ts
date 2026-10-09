import { Router, Response } from 'express';
import crypto from 'crypto';
import { execute, query, queryOne } from '../db/database.js';
import { requireAuth, requireTenant, requireRoles, requireSuperAdmin, AuthenticatedRequest } from '../auth/middleware.js';

const router = Router();

// GET /api/billing/plans - list all available subscription plans
router.get('/plans', (_req, res: Response) => {
  try {
    const plans = query('SELECT * FROM subscription_plans ORDER BY price_eur ASC');
    res.json({ plans });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/billing/current - tenant's current subscription & invoices
router.get('/current', requireAuth, requireTenant, (req: AuthenticatedRequest, res: Response) => {
  try {
    const subscription = queryOne(
      `SELECT s.*, p.name as plan_name, p.slug as plan_slug, p.price_eur, p.price_tnd,
              p.max_users, p.max_stores, p.max_whatsapp_messages, p.max_automations, p.features_json
       FROM subscriptions s
       JOIN subscription_plans p ON p.id = s.plan_id
       WHERE s.company_id = ?`,
      [req.tenantId]
    );

    const invoices = query(
      'SELECT * FROM invoices WHERE company_id = ? ORDER BY created_at DESC',
      [req.tenantId]
    );

    // Current usage metrics
    const userCount = queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM company_memberships WHERE company_id = ? AND status = "active"',
      [req.tenantId]
    )?.count || 0;

    const storeCount = queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM integrations WHERE company_id = ? AND status = "connected"',
      [req.tenantId]
    )?.count || 0;

    const automationCount = queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM automation_rules WHERE company_id = ? AND enabled = 1',
      [req.tenantId]
    )?.count || 0;

    res.json({
      subscription,
      invoices,
      usage: {
        currentUsers: userCount,
        currentStores: storeCount,
        currentAutomations: automationCount,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/billing/submit-receipt - submit manual payment proof (virement bancaire / D17)
router.post('/submit-receipt', requireAuth, requireTenant, requireRoles(['owner', 'admin']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const { plan_id, receipt_reference, receipt_note, payment_method = 'manual_bank_transfer' } = req.body;
    if (!plan_id || !receipt_reference) {
      res.status(400).json({ error: 'Identifiant du forfait et référence du virement requis.' });
      return;
    }

    const plan = queryOne<{ id: string; price_eur: number; price_tnd: number }>(
      'SELECT id, price_eur, price_tnd FROM subscription_plans WHERE id = ?',
      [plan_id]
    );

    if (!plan) {
      res.status(404).json({ error: 'Forfait introuvable' });
      return;
    }

    const invoiceId = 'inv_' + crypto.randomBytes(6).toString('hex');
    execute(
      `INSERT INTO invoices (
        id, company_id, amount_eur, amount_tnd, status, payment_method, receipt_reference, receipt_note
      ) VALUES (?, ?, ?, ?, 'pending_verification', ?, ?, ?)`,
      [
        invoiceId,
        req.tenantId,
        plan.price_eur,
        plan.price_tnd,
        payment_method,
        receipt_reference.trim(),
        receipt_note || 'Paiement soumis par le client pour vérification bancaire',
      ]
    );

    res.status(201).json({
      message: 'Justificatif de paiement transmis avec succès. Votre abonnement sera activé dès vérification comptable par notre équipe.',
      invoiceId,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/billing/admin-approve - SuperAdmin approves payment and activates subscription
router.post('/admin-approve', requireAuth, requireSuperAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { invoiceId, planId } = req.body;
    const invoice = queryOne<{ id: string; company_id: string; amount_eur: number }>(
      'SELECT id, company_id, amount_eur FROM invoices WHERE id = ?',
      [invoiceId]
    );

    if (!invoice) {
      res.status(404).json({ error: 'Facture introuvable' });
      return;
    }

    const targetPlan = queryOne<{ id: string; billing_cycle_months: number }>(
      'SELECT id, billing_cycle_months FROM subscription_plans WHERE id = ?',
      [planId || 'plan_pro_quarterly']
    );

    const now = new Date();
    const months = targetPlan?.billing_cycle_months || 3;
    const periodEnd = new Date(now.getTime() + months * 30 * 24 * 60 * 60 * 1000);

    // Update invoice
    execute(
      `UPDATE invoices SET status = 'paid', verified_by_user_id = ?, verified_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [req.user!.id, invoice.id]
    );

    // Activate subscription
    execute(
      `UPDATE subscriptions
       SET plan_id = ?, status = 'active', current_period_start = ?, current_period_end = ?, updated_at = CURRENT_TIMESTAMP
       WHERE company_id = ?`,
      [targetPlan?.id || 'plan_pro_quarterly', now.toISOString(), periodEnd.toISOString(), invoice.company_id]
    );

    // Record audit log
    execute(
      `INSERT INTO audit_logs (id, company_id, user_id, action, resource_type, resource_id, details_json)
       VALUES (?, ?, ?, 'subscription_activated_manual', 'invoice', ?, ?)`,
      [
        'aud_' + crypto.randomBytes(6).toString('hex'),
        invoice.company_id,
        req.user!.id,
        invoice.id,
        JSON.stringify({ planId, periodEnd: periodEnd.toISOString() }),
      ]
    );

    res.json({ message: 'Paiement vérifié et abonnement activé avec succès.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
