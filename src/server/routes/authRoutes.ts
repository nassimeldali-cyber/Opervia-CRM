import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { execute, query, queryOne } from '../db/database.js';
import { generateToken, requireAuth, AuthenticatedRequest } from '../auth/middleware.js';

const router = Router();

// POST /api/auth/register
router.post('/register', async (req, res: Response) => {
  try {
    const { email, password, full_name, company_name } = req.body;
    if (!email || !password || !full_name) {
      res.status(400).json({ error: 'Tous les champs obligatoires doivent être renseignés.' });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères.' });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const existing = queryOne('SELECT id FROM users WHERE email = ?', [cleanEmail]);
    if (existing) {
      res.status(409).json({ error: 'Une adresse e-mail identique existe déjà.' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = 'usr_' + crypto.randomBytes(6).toString('hex');

    execute(
      `INSERT INTO users (id, email, password_hash, full_name)
       VALUES (?, ?, ?, ?)`,
      [userId, cleanEmail, passwordHash, full_name.trim()]
    );

    // If company_name provided, create company immediately
    let companyId: string | null = null;
    if (company_name) {
      companyId = 'cmp_' + crypto.randomBytes(6).toString('hex');
      const slug = company_name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.random().toString(36).substring(2, 6);
      execute(
        `INSERT INTO companies (id, name, slug, country, currency, timezone, business_model, status)
         VALUES (?, ?, ?, 'TN', 'TND', 'Africa/Tunis', 'ecommerce_cod', 'active')`,
        [companyId, company_name.trim(), slug]
      );

      execute(
        `INSERT INTO company_memberships (id, company_id, user_id, role, status)
         VALUES (?, ?, ?, 'owner', 'active')`,
        ['mem_' + crypto.randomBytes(6).toString('hex'), companyId, userId]
      );

      // Assign default 14-day trial
      const starterPlan = queryOne<{ id: string }>('SELECT id FROM subscription_plans WHERE slug = "starter_monthly"');
      const now = new Date();
      const periodEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
      execute(
        `INSERT INTO subscriptions (id, company_id, plan_id, status, current_period_start, current_period_end)
         VALUES (?, ?, ?, 'trial', ?, ?)`,
        ['sub_' + crypto.randomBytes(6).toString('hex'), companyId, starterPlan?.id || 'plan_starter_monthly', now.toISOString(), periodEnd.toISOString()]
      );
    }

    const token = generateToken({ userId, email: cleanEmail });
    res.status(201).json({
      message: 'Compte créé avec succès',
      token,
      user: { id: userId, email: cleanEmail, full_name: full_name.trim(), is_superadmin: 0 },
      companyId,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'Email et mot de passe requis.' });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = queryOne<any>('SELECT * FROM users WHERE email = ?', [cleanEmail]);
    if (!user) {
      res.status(401).json({ error: 'Identifiants invalides.' });
      return;
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      res.status(401).json({ error: 'Identifiants invalides.' });
      return;
    }

    // Get companies for this user
    const companies = query<any>(
      `SELECT c.id, c.name, c.slug, c.currency, c.status, cm.role
       FROM company_memberships cm
       JOIN companies c ON c.id = cm.company_id
       WHERE cm.user_id = ? AND cm.status = 'active'`,
      [user.id]
    );

    const token = generateToken({ userId: user.id, email: user.email });
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        is_superadmin: user.is_superadmin === 1,
      },
      companies,
      activeCompany: companies[0] || null,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const companies = query<any>(
    `SELECT c.id, c.name, c.slug, c.currency, c.status, cm.role
     FROM company_memberships cm
     JOIN companies c ON c.id = cm.company_id
     WHERE cm.user_id = ? AND cm.status = 'active'`,
    [user.id]
  );

  res.json({
    user: {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      is_superadmin: user.is_superadmin === 1,
    },
    companies,
  });
});

export default router;
