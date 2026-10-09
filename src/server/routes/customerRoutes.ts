import { Router, Response } from 'express';
import crypto from 'crypto';
import { execute, query, queryOne } from '../db/database.js';
import { requireAuth, requireTenant, AuthenticatedRequest } from '../auth/middleware.js';
import { normalizePhoneNumber } from '../services/phoneNormalizer.js';

const router = Router();

// GET /api/customers - list customers
router.get('/', requireAuth, requireTenant, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { search, governorate, consent, limit = '50', offset = '0' } = req.query;

    let sql = 'SELECT * FROM customers WHERE company_id = ?';
    const params: any[] = [req.tenantId];

    if (governorate && governorate !== 'all') {
      sql += ' AND governorate = ?';
      params.push(governorate);
    }

    if (consent && consent !== 'all') {
      sql += ' AND consent_status = ?';
      params.push(consent);
    }

    if (search) {
      sql += ' AND (full_name LIKE ? OR phone LIKE ? OR phone_normalized LIKE ? OR email LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));

    const customers = query(sql, params);

    const totalCount = queryOne<{ total: number }>(
      'SELECT COUNT(*) as total FROM customers WHERE company_id = ?',
      [req.tenantId]
    )?.total || 0;

    res.json({ customers, total: totalCount });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/customers/:id - customer profile with orders & conversations
router.get('/:id', requireAuth, requireTenant, (req: AuthenticatedRequest, res: Response) => {
  try {
    const customer = queryOne(
      'SELECT * FROM customers WHERE id = ? AND company_id = ?',
      [req.params.id, req.tenantId]
    );

    if (!customer) {
      res.status(404).json({ error: 'Client introuvable.' });
      return;
    }

    const orders = query(
      'SELECT * FROM orders WHERE customer_id = ? AND company_id = ? ORDER BY created_at DESC',
      [req.params.id, req.tenantId]
    );

    const conversations = query(
      'SELECT * FROM conversations WHERE customer_id = ? AND company_id = ? ORDER BY last_message_at DESC',
      [req.params.id, req.tenantId]
    );

    res.json({ customer, orders, conversations });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/customers - create customer
router.post('/', requireAuth, requireTenant, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { full_name, phone, email, governorate, city, address, notes, tags } = req.body;
    if (!full_name || !phone) {
      res.status(400).json({ error: 'Nom complet et numéro de téléphone requis.' });
      return;
    }

    const norm = normalizePhoneNumber(phone);
    if (!norm.isValid) {
      res.status(400).json({ error: `Numéro de téléphone invalide: ${phone}. Les numéros tunisiens doivent comporter 8 chiffres.` });
      return;
    }

    const existing = queryOne(
      'SELECT id FROM customers WHERE company_id = ? AND phone_normalized = ?',
      [req.tenantId, norm.normalized]
    );

    if (existing) {
      res.status(409).json({ error: 'Un client avec ce numéro de téléphone existe déjà dans votre base.' });
      return;
    }

    const customerId = 'cst_' + crypto.randomBytes(6).toString('hex');
    execute(
      `INSERT INTO customers (
        id, company_id, full_name, phone, phone_normalized, email, country, governorate,
        city, address, notes, tags_json, acquisition_channel, consent_status
      ) VALUES (?, ?, ?, ?, ?, ?, 'TN', ?, ?, ?, ?, ?, 'manual', 'opt_in')`,
      [
        customerId,
        req.tenantId,
        full_name.trim(),
        phone,
        norm.normalized,
        email || null,
        governorate || 'Tunis',
        city || governorate || 'Tunis',
        address || '',
        notes || '',
        JSON.stringify(tags || []),
      ]
    );

    res.status(201).json({ message: 'Client créé avec succès', customerId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/customers/:id - update customer
router.put('/:id', requireAuth, requireTenant, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { full_name, phone, email, governorate, city, address, notes, tags, consent_status } = req.body;
    const customer = queryOne('SELECT id FROM customers WHERE id = ? AND company_id = ?', [req.params.id, req.tenantId]);
    if (!customer) {
      res.status(404).json({ error: 'Client introuvable.' });
      return;
    }

    let normNormalized: string | undefined;
    if (phone) {
      const norm = normalizePhoneNumber(phone);
      if (norm.isValid) {
        normNormalized = norm.normalized;
      }
    }

    let optOutSql = '';
    if (consent_status === 'opt_out') {
      optOutSql = ', opt_out_at = CURRENT_TIMESTAMP';
    }

    execute(
      `UPDATE customers
       SET full_name = COALESCE(?, full_name),
           phone = COALESCE(?, phone),
           phone_normalized = COALESCE(?, phone_normalized),
           email = COALESCE(?, email),
           governorate = COALESCE(?, governorate),
           city = COALESCE(?, city),
           address = COALESCE(?, address),
           notes = COALESCE(?, notes),
           tags_json = COALESCE(?, tags_json),
           consent_status = COALESCE(?, consent_status),
           updated_at = CURRENT_TIMESTAMP
           ${optOutSql}
       WHERE id = ? AND company_id = ?`,
      [
        full_name,
        phone,
        normNormalized,
        email,
        governorate,
        city,
        address,
        notes,
        tags ? JSON.stringify(tags) : null,
        consent_status,
        req.params.id,
        req.tenantId,
      ]
    );

    res.json({ message: 'Fiche client mise à jour avec succès.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/customers/merge - safely merge two duplicate customers
router.post('/merge', requireAuth, requireTenant, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { primaryCustomerId, duplicateCustomerId } = req.body;
    if (!primaryCustomerId || !duplicateCustomerId || primaryCustomerId === duplicateCustomerId) {
      res.status(400).json({ error: 'Identifiants client principal et doublon requis et distincts.' });
      return;
    }

    const primary = queryOne('SELECT * FROM customers WHERE id = ? AND company_id = ?', [primaryCustomerId, req.tenantId]);
    const duplicate = queryOne('SELECT * FROM customers WHERE id = ? AND company_id = ?', [duplicateCustomerId, req.tenantId]);

    if (!primary || !duplicate) {
      res.status(404).json({ error: 'Un ou plusieurs clients introuvables.' });
      return;
    }

    // Re-link orders to primary
    execute('UPDATE orders SET customer_id = ? WHERE customer_id = ? AND company_id = ?', [primaryCustomerId, duplicateCustomerId, req.tenantId]);

    // Re-link conversations to primary
    execute('UPDATE conversations SET customer_id = ? WHERE customer_id = ? AND company_id = ?', [primaryCustomerId, duplicateCustomerId, req.tenantId]);

    // Update primary totals
    const orderStats = queryOne<{ totalOrders: number; totalSpent: number; totalRefused: number }>(
      `SELECT COUNT(*) as totalOrders, SUM(total_tnd) as totalSpent,
              SUM(CASE WHEN status = 'refused' THEN 1 ELSE 0 END) as totalRefused
       FROM orders WHERE customer_id = ? AND company_id = ?`,
      [primaryCustomerId, req.tenantId]
    );

    execute(
      `UPDATE customers
       SET total_orders = ?, total_spent_tnd = ?, refused_orders_count = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND company_id = ?`,
      [orderStats?.totalOrders || 0, orderStats?.totalSpent || 0, orderStats?.totalRefused || 0, primaryCustomerId, req.tenantId]
    );

    // Remove duplicate customer
    execute('DELETE FROM customers WHERE id = ? AND company_id = ?', [duplicateCustomerId, req.tenantId]);

    res.json({ message: 'Clients fusionnés avec succès.', primaryId: primaryCustomerId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
