import { Router, Response } from 'express';
import { execute, query, queryOne } from '../db/database.js';
import { requireAuth, requireSuperAdmin, AuthenticatedRequest } from '../auth/middleware.js';

const router = Router();

// GET /api/superadmin/metrics
router.get('/metrics', requireAuth, requireSuperAdmin, (_req: AuthenticatedRequest, res: Response) => {
  try {
    const totalTenants = queryOne<{ count: number }>('SELECT COUNT(*) as count FROM companies')?.count || 0;
    const activeSubscriptions = queryOne<{ count: number }>('SELECT COUNT(*) as count FROM subscriptions WHERE status = "active"')?.count || 0;
    const totalUsers = queryOne<{ count: number }>('SELECT COUNT(*) as count FROM users')?.count || 0;
    const totalOrders = queryOne<{ count: number }>('SELECT COUNT(*) as count FROM orders')?.count || 0;
    const pendingInvoices = queryOne<{ count: number }>('SELECT COUNT(*) as count FROM invoices WHERE status = "pending_verification"')?.count || 0;
    const failedJobs = queryOne<{ count: number }>('SELECT COUNT(*) as count FROM background_jobs WHERE status = "failed"')?.count || 0;

    res.json({
      metrics: {
        totalTenants,
        activeSubscriptions,
        totalUsers,
        totalOrders,
        pendingInvoices,
        failedJobs,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/superadmin/tenants
router.get('/tenants', requireAuth, requireSuperAdmin, (_req: AuthenticatedRequest, res: Response) => {
  try {
    const tenants = query(
      `SELECT c.*, s.status as subscription_status, p.name as plan_name,
              u.email as owner_email, u.full_name as owner_name,
              (SELECT COUNT(*) FROM orders WHERE company_id = c.id) as order_count,
              (SELECT COUNT(*) FROM customers WHERE company_id = c.id) as customer_count
       FROM companies c
       LEFT JOIN subscriptions s ON s.company_id = c.id
       LEFT JOIN subscription_plans p ON p.id = s.plan_id
       LEFT JOIN company_memberships cm ON cm.company_id = c.id AND cm.role = 'owner'
       LEFT JOIN users u ON u.id = cm.user_id
       ORDER BY c.created_at DESC`
    );

    res.json({ tenants });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/superadmin/tenants/:id/status - suspend or reactivate tenant
router.patch('/tenants/:id/status', requireAuth, requireSuperAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status } = req.body;
    if (!['active', 'suspended'].includes(status)) {
      res.status(400).json({ error: 'Statut invalide.' });
      return;
    }

    execute('UPDATE companies SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, req.params.id]);

    // Audit log
    execute(
      `INSERT INTO audit_logs (id, company_id, user_id, action, resource_type, resource_id, details_json)
       VALUES (?, ?, ?, ?, 'company', ?, ?)`,
      [
        'aud_' + Math.random().toString(36).substring(2, 9),
        req.params.id,
        req.user!.id,
        status === 'suspended' ? 'tenant_suspended' : 'tenant_reactivated',
        req.params.id,
        JSON.stringify({ newStatus: status }),
      ]
    );

    res.json({ message: `Entreprise ${status === 'suspended' ? 'suspendue' : 'réactivée'}.` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/superadmin/invoices - view all pending invoices for review
router.get('/invoices', requireAuth, requireSuperAdmin, (_req: AuthenticatedRequest, res: Response) => {
  try {
    const invoices = query(
      `SELECT inv.*, c.name as company_name, c.slug as company_slug
       FROM invoices inv
       JOIN companies c ON c.id = inv.company_id
       ORDER BY inv.created_at DESC`
    );
    res.json({ invoices });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
