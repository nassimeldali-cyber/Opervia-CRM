import { Router, Response } from 'express';
import crypto from 'crypto';
import { execute, query, queryOne } from '../db/database.js';
import { requireAuth, requireTenant, AuthenticatedRequest } from '../auth/middleware.js';
import { ORDER_STATUSES, VALID_STATUS_TRANSITIONS, OrderStatus, TUNISIAN_GOVERNORATES } from '../constants.js';
import { normalizePhoneNumber } from '../services/phoneNormalizer.js';
import { WooCommerceService } from '../services/woocommerceService.js';
import { AutomationEngine } from '../services/automationEngine.js';

const router = Router();

// GET /api/orders - list orders with filtering & pagination
router.get('/', requireAuth, requireTenant, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status, governorate, search, limit = '50', offset = '0' } = req.query;

    let sql = `
      SELECT o.*, u.full_name as assigned_agent_name
      FROM orders o
      LEFT JOIN users u ON u.id = o.assigned_agent_id
      WHERE o.company_id = ?
    `;
    const params: any[] = [req.tenantId];

    if (status && status !== 'all') {
      sql += ' AND o.status = ?';
      params.push(status);
    }

    if (governorate && governorate !== 'all') {
      sql += ' AND o.governorate = ?';
      params.push(governorate);
    }

    if (search) {
      sql += ' AND (o.customer_name LIKE ? OR o.customer_phone LIKE ? OR o.id LIKE ? OR o.external_id LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    sql += ' ORDER BY o.created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));

    const orders = query(sql, params);

    // Total count for pagination
    let countSql = 'SELECT COUNT(*) as total FROM orders WHERE company_id = ?';
    const countParams: any[] = [req.tenantId];
    if (status && status !== 'all') {
      countSql += ' AND status = ?';
      countParams.push(status);
    }
    const totalCount = queryOne<{ total: number }>(countSql, countParams)?.total || 0;

    res.json({ orders, total: totalCount });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/orders/:id - single order details, items, timeline
router.get('/:id', requireAuth, requireTenant, (req: AuthenticatedRequest, res: Response) => {
  try {
    const order = queryOne(
      `SELECT o.*, c.phone_normalized as customer_norm_phone, c.notes as customer_crm_notes, u.full_name as assigned_agent_name
       FROM orders o
       JOIN customers c ON c.id = o.customer_id
       LEFT JOIN users u ON u.id = o.assigned_agent_id
       WHERE o.id = ? AND o.company_id = ?`,
      [req.params.id, req.tenantId]
    );

    if (!order) {
      res.status(404).json({ error: 'Commande introuvable' });
      return;
    }

    const items = query(
      'SELECT * FROM order_items WHERE order_id = ? AND company_id = ?',
      [req.params.id, req.tenantId]
    );

    const history = query(
      `SELECT h.*, u.full_name as user_name
       FROM order_status_history h
       LEFT JOIN users u ON u.id = h.changed_by_user_id
       WHERE h.order_id = ? AND h.company_id = ?
       ORDER BY h.created_at ASC`,
      [req.params.id, req.tenantId]
    );

    res.json({ order, items, history });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/orders - manual order creation
router.post('/', requireAuth, requireTenant, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      customer_name,
      customer_phone,
      governorate,
      city,
      address,
      items,
      shipping_tnd = 7.0,
      discount_tnd = 0,
      payment_method = 'cod',
      customer_notes,
      source_channel = 'manual',
    } = req.body;

    if (!customer_name || !customer_phone || !governorate || !address || !items || items.length === 0) {
      res.status(400).json({ error: 'Veuillez remplir tous les champs obligatoires (nom, téléphone, gouvernorat, adresse, articles).' });
      return;
    }

    const normPhone = normalizePhoneNumber(customer_phone);

    // Find or create customer
    let customer = queryOne<{ id: string }>(
      'SELECT id FROM customers WHERE company_id = ? AND phone_normalized = ?',
      [req.tenantId, normPhone.normalized]
    );

    let customerId = customer?.id;
    if (!customerId) {
      customerId = 'cst_' + crypto.randomBytes(6).toString('hex');
      execute(
        `INSERT INTO customers (id, company_id, full_name, phone, phone_normalized, country, governorate, city, address, acquisition_channel, consent_status)
         VALUES (?, ?, ?, ?, ?, 'TN', ?, ?, ?, ?, 'opt_in')`,
        [customerId, req.tenantId, customer_name.trim(), customer_phone, normPhone.normalized, governorate, city || governorate, address, source_channel]
      );
    }

    // Calculate totals
    let subtotal = 0;
    const summaryItems: string[] = [];
    for (const item of items) {
      const q = Number(item.quantity) || 1;
      const p = Number(item.unit_price_tnd) || 0;
      subtotal += q * p;
      summaryItems.push(`${q}x ${item.product_name}`);
    }

    const total = subtotal + Number(shipping_tnd) - Number(discount_tnd);
    const orderId = 'ord_' + crypto.randomBytes(6).toString('hex');

    execute(
      `INSERT INTO orders (
        id, company_id, source_channel, customer_id, customer_name, customer_phone,
        governorate, city, address, products_summary, cod_amount_tnd, subtotal_tnd,
        shipping_tnd, discount_tnd, total_tnd, currency, payment_method, payment_status,
        status, customer_notes, assigned_agent_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'TND', ?, 'pending', 'to_confirm', ?, ?)`,
      [
        orderId,
        req.tenantId,
        source_channel,
        customerId,
        customer_name.trim(),
        normPhone.normalized,
        governorate,
        city || governorate,
        address,
        summaryItems.join(', '),
        total,
        subtotal,
        shipping_tnd,
        discount_tnd,
        total,
        payment_method,
        customer_notes || null,
        req.user!.id,
      ]
    );

    // Insert items
    for (const item of items) {
      const q = Number(item.quantity) || 1;
      const p = Number(item.unit_price_tnd) || 0;
      execute(
        `INSERT INTO order_items (id, company_id, order_id, product_id, sku, product_name, quantity, unit_price_tnd, total_price_tnd)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          'oit_' + crypto.randomBytes(6).toString('hex'),
          req.tenantId,
          orderId,
          item.product_id || null,
          item.sku || 'SKU-MANUAL',
          item.product_name,
          q,
          p,
          q * p,
        ]
      );
    }

    // Record initial status history
    execute(
      `INSERT INTO order_status_history (id, company_id, order_id, from_status, to_status, changed_by_user_id, reason)
       VALUES (?, ?, ?, 'new', 'to_confirm', ?, 'Création manuelle de commande')`,
      ['osh_' + crypto.randomBytes(6).toString('hex'), req.tenantId, orderId, req.user!.id]
    );

    // Update customer stats
    execute(
      `UPDATE customers SET total_orders = total_orders + 1, total_spent_tnd = total_spent_tnd + ? WHERE id = ?`,
      [total, customerId]
    );

    // Trigger automations
    await AutomationEngine.evaluateOrderCreated(req.tenantId!, orderId);

    res.status(201).json({ message: 'Commande créée avec succès', orderId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/orders/:id/status - status transition with validation
router.patch('/:id/status', requireAuth, requireTenant, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status: targetStatus, reason } = req.body;
    if (!targetStatus || !ORDER_STATUSES.includes(targetStatus)) {
      res.status(400).json({ error: 'Statut de commande invalide.' });
      return;
    }

    const order = queryOne<{ id: string; status: OrderStatus; customer_id: string }>(
      'SELECT id, status, customer_id FROM orders WHERE id = ? AND company_id = ?',
      [req.params.id, req.tenantId]
    );

    if (!order) {
      res.status(404).json({ error: 'Commande introuvable.' });
      return;
    }

    const currentStatus = order.status;
    if (currentStatus === targetStatus) {
      res.json({ message: 'Le statut est déjà à jour.', status: currentStatus });
      return;
    }

    // Role and workflow transition verification
    const allowedTransitions = VALID_STATUS_TRANSITIONS[currentStatus] || [];
    const isSuperOrAdmin = req.user!.is_superadmin || ['owner', 'admin'].includes(req.tenantRole || '');

    if (!allowedTransitions.includes(targetStatus) && !isSuperOrAdmin) {
      res.status(422).json({
        error: `Transition invalide : Impossible de passer de "${currentStatus}" à "${targetStatus}". Transitions permises : ${allowedTransitions.join(', ') || 'aucune'}.`,
      });
      return;
    }

    // Timestamp updates
    let timestampUpdate = '';
    if (targetStatus === 'confirmed') timestampUpdate = ', confirmed_at = CURRENT_TIMESTAMP';
    if (targetStatus === 'shipped') timestampUpdate = ', shipped_at = CURRENT_TIMESTAMP';
    if (targetStatus === 'delivered') timestampUpdate = ', delivered_at = CURRENT_TIMESTAMP, payment_status = "paid"';
    if (targetStatus === 'refused') {
      // Increment customer refusal count
      execute('UPDATE customers SET refused_orders_count = refused_orders_count + 1 WHERE id = ?', [order.customer_id]);
    }

    execute(
      `UPDATE orders
       SET status = ?, updated_at = CURRENT_TIMESTAMP ${timestampUpdate}
       WHERE id = ? AND company_id = ?`,
      [targetStatus, order.id, req.tenantId]
    );

    // Audit log in status history
    execute(
      `INSERT INTO order_status_history (id, company_id, order_id, from_status, to_status, changed_by_user_id, reason)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        'osh_' + crypto.randomBytes(6).toString('hex'),
        req.tenantId,
        order.id,
        currentStatus,
        targetStatus,
        req.user!.id,
        reason || 'Mise à jour via tableau de bord',
      ]
    );

    // Evaluate automation triggers
    await AutomationEngine.evaluateOrderStatusChanged(req.tenantId!, order.id, currentStatus, targetStatus);

    res.json({ message: 'Statut mis à jour avec succès', from: currentStatus, to: targetStatus });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/orders/bulk-status - bulk transition
router.post('/bulk-status', requireAuth, requireTenant, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { orderIds, status: targetStatus, reason } = req.body;
    if (!Array.isArray(orderIds) || orderIds.length === 0 || !ORDER_STATUSES.includes(targetStatus)) {
      res.status(400).json({ error: "Liste d'identifiants et statut valide requis." });
      return;
    }

    let successCount = 0;
    const errors: string[] = [];

    for (const id of orderIds) {
      const order = queryOne<{ id: string; status: OrderStatus }>(
        'SELECT id, status FROM orders WHERE id = ? AND company_id = ?',
        [id, req.tenantId]
      );
      if (!order) continue;

      execute(
        `UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND company_id = ?`,
        [targetStatus, id, req.tenantId]
      );

      execute(
        `INSERT INTO order_status_history (id, company_id, order_id, from_status, to_status, changed_by_user_id, reason)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          'osh_' + crypto.randomBytes(6).toString('hex'),
          req.tenantId,
          id,
          order.status,
          targetStatus,
          req.user!.id,
          reason || 'Mise à jour en masse',
        ]
      );
      successCount++;
    }

    res.json({ message: `${successCount} commande(s) mise(s) à jour`, successCount, errors });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/orders/export/csv - export orders as CSV
router.get('/export/csv', requireAuth, requireTenant, (req: AuthenticatedRequest, res: Response) => {
  try {
    const orders = query(
      `SELECT id, external_id, source_channel, customer_name, customer_phone, governorate, city, address,
              products_summary, cod_amount_tnd, total_tnd, status, payment_method, delivery_carrier, tracking_number, created_at
       FROM orders WHERE company_id = ? ORDER BY created_at DESC`,
      [req.tenantId]
    );

    const headers = ['ID', 'Reference_Externe', 'Canal', 'Client', 'Telephone', 'Gouvernorat', 'Ville', 'Adresse', 'Articles', 'Montant_COD_TND', 'Total_TND', 'Statut', 'Methode_Paiement', 'Transporteur', 'Numero_Suivi', 'Date_Creation'];
    const rows = orders.map((o: any) => [
      o.id,
      o.external_id || '',
      o.source_channel || '',
      `"${(o.customer_name || '').replace(/"/g, '""')}"`,
      `"${o.customer_phone || ''}"`,
      `"${o.governorate || ''}"`,
      `"${o.city || ''}"`,
      `"${(o.address || '').replace(/"/g, '""')}"`,
      `"${(o.products_summary || '').replace(/"/g, '""')}"`,
      o.cod_amount_tnd,
      o.total_tnd,
      o.status,
      o.payment_method,
      o.delivery_carrier || '',
      o.tracking_number || '',
      o.created_at,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="commandes_opervia.csv"');
    res.send(csvContent);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/orders/import/csv - import orders with phone & governorate normalization
router.post('/import/csv', requireAuth, requireTenant, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { csvText } = req.body;
    if (!csvText || typeof csvText !== 'string') {
      res.status(400).json({ error: 'Contenu CSV requis.' });
      return;
    }

    const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      res.status(400).json({ error: 'Le fichier CSV est vide ou ne comporte pas d\'en-tête.' });
      return;
    }

    // Parse header
    const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, '').toLowerCase());
    const validRows: any[] = [];
    const invalidRows: Array<{ rowNumber: number; reason: string; data: string }> = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      // Simple CSV regex splitter respecting quotes
      const values = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(',');
      const cleanVals = values.map((v) => v.trim().replace(/^"|"$/g, ''));

      const rowMap: Record<string, string> = {};
      headers.forEach((h, idx) => {
        rowMap[h] = cleanVals[idx] || '';
      });

      const clientName = rowMap['client'] || rowMap['nom'] || rowMap['customer'] || rowMap['customer_name'];
      const rawPhone = rowMap['telephone'] || rowMap['phone'] || rowMap['tel'] || rowMap['customer_phone'];
      const gov = WooCommerceService.matchGovernorate(rowMap['gouvernorat'] || rowMap['state'] || rowMap['region']);
      const address = rowMap['adresse'] || rowMap['address'] || 'Adresse inconnue';
      const totalAmount = parseFloat(rowMap['total'] || rowMap['total_tnd'] || rowMap['montant'] || '0') || 50.0;
      const productSummary = rowMap['articles'] || rowMap['produits'] || rowMap['items'] || 'Article importé';

      if (!clientName || !rawPhone) {
        invalidRows.push({ rowNumber: i + 1, reason: 'Nom ou numéro de téléphone manquant', data: line });
        continue;
      }

      const phoneNorm = normalizePhoneNumber(rawPhone);
      if (!phoneNorm.isValid) {
        invalidRows.push({ rowNumber: i + 1, reason: `Numéro de téléphone invalide: ${rawPhone}`, data: line });
        continue;
      }

      validRows.push({
        clientName,
        phone: rawPhone,
        phoneNormalized: phoneNorm.normalized,
        gov,
        address,
        totalAmount,
        productSummary,
      });
    }

    // Insert valid rows
    let importedCount = 0;
    for (const r of validRows) {
      let customer = queryOne<{ id: string }>(
        'SELECT id FROM customers WHERE company_id = ? AND phone_normalized = ?',
        [req.tenantId, r.phoneNormalized]
      );
      let customerId = customer?.id;
      if (!customerId) {
        customerId = 'cst_' + crypto.randomBytes(6).toString('hex');
        execute(
          `INSERT INTO customers (id, company_id, full_name, phone, phone_normalized, country, governorate, address, acquisition_channel, consent_status)
           VALUES (?, ?, ?, ?, ?, 'TN', ?, ?, 'csv_import', 'opt_in')`,
          [customerId, req.tenantId, r.clientName, r.phone, r.phoneNormalized, r.gov, r.address]
        );
      }

      const orderId = 'ord_' + crypto.randomBytes(6).toString('hex');
      execute(
        `INSERT INTO orders (
          id, company_id, source_channel, customer_id, customer_name, customer_phone,
          governorate, address, products_summary, cod_amount_tnd, subtotal_tnd, total_tnd, status
        ) VALUES (?, ?, 'csv_import', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'to_confirm')`,
        [
          orderId,
          req.tenantId,
          customerId,
          r.clientName,
          r.phoneNormalized,
          r.gov,
          r.address,
          r.productSummary,
          r.totalAmount,
          r.totalAmount - 7.0,
          r.totalAmount,
        ]
      );

      execute(
        `INSERT INTO order_status_history (id, company_id, order_id, from_status, to_status, changed_by_user_id, reason)
         VALUES (?, ?, ?, 'new', 'to_confirm', ?, 'Importé via fichier CSV')`,
        ['osh_' + crypto.randomBytes(6).toString('hex'), req.tenantId, orderId, req.user!.id]
      );

      importedCount++;
    }

    res.json({
      message: `${importedCount} commande(s) importée(s) avec succès.`,
      importedCount,
      invalidCount: invalidRows.length,
      invalidRows,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
