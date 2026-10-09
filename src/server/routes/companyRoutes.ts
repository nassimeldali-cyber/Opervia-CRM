import { Router, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { execute, query, queryOne } from '../db/database.js';
import { requireAuth, requireTenant, requireRoles, AuthenticatedRequest } from '../auth/middleware.js';

const router = Router();

// POST /api/companies/onboard - Create a new company during onboarding
router.post('/onboard', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, country = 'TN', currency = 'TND', timezone = 'Africa/Tunis', business_model = 'ecommerce_cod', order_volume = '100-500' } = req.body;
    if (!name) {
      res.status(400).json({ error: "Le nom de l'entreprise est requis." });
      return;
    }

    const companyId = 'cmp_' + crypto.randomBytes(6).toString('hex');
    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.random().toString(36).substring(2, 6);

    execute(
      `INSERT INTO companies (id, name, slug, country, currency, timezone, business_model, order_volume, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [companyId, name.trim(), slug, country, currency, timezone, business_model, order_volume]
    );

    execute(
      `INSERT INTO company_memberships (id, company_id, user_id, role, status)
       VALUES (?, ?, ?, 'owner', 'active')`,
      ['mem_' + crypto.randomBytes(6).toString('hex'), companyId, req.user!.id]
    );

    // Default 14-day trial
    const starterPlan = queryOne<{ id: string }>('SELECT id FROM subscription_plans WHERE slug = "starter_monthly"');
    const now = new Date();
    const periodEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    execute(
      `INSERT INTO subscriptions (id, company_id, plan_id, status, current_period_start, current_period_end)
       VALUES (?, ?, ?, 'trial', ?, ?)`,
      ['sub_' + crypto.randomBytes(6).toString('hex'), companyId, starterPlan?.id || 'plan_starter_monthly', now.toISOString(), periodEnd.toISOString()]
    );

    res.status(201).json({
      message: 'Entreprise créée avec succès',
      company: { id: companyId, name, slug, country, currency },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/companies/current
router.get('/current', requireAuth, requireTenant, (req: AuthenticatedRequest, res: Response) => {
  const company = queryOne(
    `SELECT c.*, s.status as subscription_status, p.name as plan_name, p.slug as plan_slug
     FROM companies c
     LEFT JOIN subscriptions s ON s.company_id = c.id
     LEFT JOIN subscription_plans p ON p.id = s.plan_id
     WHERE c.id = ?`,
    [req.tenantId]
  );
  res.json({ company, userRole: req.tenantRole });
});

// PUT /api/companies/current - update settings
router.put('/current', requireAuth, requireTenant, requireRoles(['owner', 'admin']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, currency, timezone, settings } = req.body;
    if (name) {
      execute('UPDATE companies SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [name, req.tenantId]);
    }
    if (currency) {
      execute('UPDATE companies SET currency = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [currency, req.tenantId]);
    }
    if (timezone) {
      execute('UPDATE companies SET timezone = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [timezone, req.tenantId]);
    }
    if (settings) {
      execute('UPDATE companies SET settings_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [JSON.stringify(settings), req.tenantId]);
    }
    res.json({ message: 'Paramètres enregistrés avec succès' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/companies/team - list members
router.get('/team', requireAuth, requireTenant, (req: AuthenticatedRequest, res: Response) => {
  const members = query(
    `SELECT cm.id as membership_id, cm.role, cm.status, cm.created_at, u.id as user_id, u.email, u.full_name
     FROM company_memberships cm
     JOIN users u ON u.id = cm.user_id
     WHERE cm.company_id = ?`,
    [req.tenantId]
  );
  res.json({ members });
});

// POST /api/companies/team/invite - invite or add a team member
router.post('/team/invite', requireAuth, requireTenant, requireRoles(['owner', 'admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email, full_name, role } = req.body;
    if (!email || !role) {
      res.status(400).json({ error: 'Email et rôle requis.' });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    let user = queryOne<{ id: string }>('SELECT id FROM users WHERE email = ?', [cleanEmail]);

    if (!user) {
      // Create user account with a temporary password
      const tempPassword = 'Temp_' + crypto.randomBytes(4).toString('hex') + '!';
      const hash = await bcrypt.hash(tempPassword, 10);
      const newUserId = 'usr_' + crypto.randomBytes(6).toString('hex');
      execute(
        `INSERT INTO users (id, email, password_hash, full_name) VALUES (?, ?, ?, ?)`,
        [newUserId, cleanEmail, hash, full_name || cleanEmail.split('@')[0]]
      );
      user = { id: newUserId };
    }

    // Check existing membership
    const existingMember = queryOne(
      'SELECT id FROM company_memberships WHERE company_id = ? AND user_id = ?',
      [req.tenantId, user.id]
    );

    if (existingMember) {
      res.status(409).json({ error: "Cet utilisateur fait déjà partie de l'équipe." });
      return;
    }

    execute(
      `INSERT INTO company_memberships (id, company_id, user_id, role, status)
       VALUES (?, ?, ?, ?, 'active')`,
      ['mem_' + crypto.randomBytes(6).toString('hex'), req.tenantId, user.id, role]
    );

    res.status(201).json({ message: `Membre ajouté avec succès au rôle ${role}.` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
