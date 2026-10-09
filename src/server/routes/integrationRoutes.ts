import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { execute, query, queryOne } from '../db/database.js';
import { requireAuth, requireTenant, AuthenticatedRequest } from '../auth/middleware.js';
import { WooCommerceService } from '../services/woocommerceService.js';
import { normalizePhoneNumber } from '../services/phoneNormalizer.js';

const router = Router();

// GET /api/integrations - List integrations for tenant
router.get('/', requireAuth, requireTenant, (req: AuthenticatedRequest, res: Response) => {
  try {
    const integrations = query(
      `SELECT id, type, name, status, webhook_secret, last_sync_at, error_log, created_at
       FROM integrations WHERE company_id = ?`,
      [req.tenantId]
    );

    res.json({ integrations });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/integrations/connect - Connect or update integration credentials
router.post('/connect', requireAuth, requireTenant, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { type, name, credentials } = req.body;
    if (!type || !name) {
      res.status(400).json({ error: "Type et nom de l'intégration requis." });
      return;
    }

    const existing = queryOne<{ id: string }>(
      'SELECT id FROM integrations WHERE company_id = ? AND type = ?',
      [req.tenantId, type]
    );

    const webhookSecret = crypto.randomBytes(16).toString('hex');
    const credsJson = JSON.stringify(credentials || {});

    if (existing) {
      execute(
        `UPDATE integrations
         SET name = ?, credentials_json = ?, status = 'connected', last_sync_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [name, credsJson, existing.id]
      );
      res.json({ message: 'Intégration mise à jour avec succès.', integrationId: existing.id });
    } else {
      const integrationId = 'int_' + crypto.randomBytes(6).toString('hex');
      execute(
        `INSERT INTO integrations (id, company_id, type, name, status, credentials_json, webhook_secret, last_sync_at)
         VALUES (?, ?, ?, ?, 'connected', ?, ?, CURRENT_TIMESTAMP)`,
        [integrationId, req.tenantId, type, name, credsJson, webhookSecret]
      );
      res.status(201).json({ message: 'Intégration connectée avec succès.', integrationId, webhookSecret });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/integrations/woocommerce/webhook - Live WooCommerce Order Webhook
router.post('/woocommerce/webhook', async (req: Request, res: Response) => {
  try {
    const tenantId = (req.query.tenantId as string) || (req.headers['x-tenant-id'] as string);
    const signature = req.headers['x-wc-webhook-signature'] as string;
    const webhookEventId = (req.headers['x-wc-webhook-id'] as string) || (req.body?.id ? `wc_${req.body.id}` : undefined);
    const rawBody = (req as any).rawBody || JSON.stringify(req.body);

    if (!tenantId) {
      res.status(400).json({ error: 'Identifiant d\'entreprise (tenantId) manquant dans la requête.' });
      return;
    }

    const integration = queryOne<{ webhook_secret: string; credentials_json: string }>(
      'SELECT webhook_secret, credentials_json FROM integrations WHERE company_id = ? AND type = "woocommerce"',
      [tenantId]
    );

    const secret = integration?.webhook_secret || process.env.WOOCOMMERCE_WEBHOOK_SECRET || '';

    // Verify HMAC-SHA256 signature if secret is present
    if (signature && secret) {
      const isValid = WooCommerceService.verifySignature(rawBody, signature, secret);
      if (!isValid) {
        res.status(401).json({ error: 'Signature WooCommerce invalide.' });
        return;
      }
    }

    const result = await WooCommerceService.processOrderWebhook(tenantId, req.body, webhookEventId);

    if (!result.success) {
      res.status(500).json({ error: result.error });
      return;
    }

    res.status(200).json({
      status: 'success',
      orderId: result.orderId,
      skippedDuplicate: result.skippedDuplicate,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/integrations/custom/orders - Secure REST API for Custom E-Commerce Websites
router.post('/custom/orders', async (req: Request, res: Response) => {
  try {
    const apiKey = req.headers['x-api-key'] as string;
    const idempotencyKey = req.headers['x-idempotency-key'] as string;

    if (!apiKey) {
      res.status(401).json({ error: 'En-tête X-API-KEY manquant.' });
      return;
    }

    // Look up integration by secret / key
    const integration = queryOne<{ company_id: string }>(
      'SELECT company_id FROM integrations WHERE webhook_secret = ? AND type = "custom_api"',
      [apiKey]
    );

    if (!integration) {
      res.status(403).json({ error: 'Clé API personnalisée non reconnue.' });
      return;
    }

    const companyId = integration.company_id;

    // Idempotency check
    if (idempotencyKey) {
      const existing = queryOne(
        'SELECT id FROM webhook_events WHERE company_id = ? AND provider = "custom_api" AND event_id = ?',
        [companyId, idempotencyKey]
      );
      if (existing) {
        res.status(200).json({ message: 'Commande déjà traitée (idempotent)', skipped: true });
        return;
      }
    }

    const { customer_name, customer_phone, governorate, address, items, total_amount_tnd, external_id } = req.body;
    if (!customer_name || !customer_phone || !governorate || !total_amount_tnd) {
      res.status(400).json({ error: 'Champs obligatoires manquants: customer_name, customer_phone, governorate, total_amount_tnd.' });
      return;
    }

    const normPhone = normalizePhoneNumber(customer_phone);
    let customer = queryOne<{ id: string }>('SELECT id FROM customers WHERE company_id = ? AND phone_normalized = ?', [companyId, normPhone.normalized]);

    let customerId = customer?.id;
    if (!customerId) {
      customerId = 'cst_' + crypto.randomBytes(6).toString('hex');
      execute(
        `INSERT INTO customers (id, company_id, full_name, phone, phone_normalized, country, governorate, address, acquisition_channel, consent_status)
         VALUES (?, ?, ?, ?, ?, 'TN', ?, ?, 'custom_api', 'opt_in')`,
        [customerId, companyId, customer_name, customer_phone, normPhone.normalized, governorate, address || '']
      );
    }

    const orderId = 'ord_' + crypto.randomBytes(6).toString('hex');
    const itemsSummary = Array.isArray(items) ? items.map((i: any) => `${i.quantity || 1}x ${i.name || 'Produit'}`).join(', ') : 'Article sur mesure';

    execute(
      `INSERT INTO orders (
        id, company_id, external_id, source_channel, customer_id, customer_name, customer_phone,
        governorate, address, products_summary, cod_amount_tnd, subtotal_tnd, total_tnd, status
      ) VALUES (?, ?, ?, 'custom_api', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'to_confirm')`,
      [
        orderId,
        companyId,
        external_id || `API-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        customerId,
        customer_name,
        normPhone.normalized,
        governorate,
        address || '',
        itemsSummary,
        Number(total_amount_tnd),
        Number(total_amount_tnd) - 7.0,
        Number(total_amount_tnd),
      ]
    );

    if (idempotencyKey) {
      execute(
        `INSERT INTO webhook_events (id, company_id, provider, event_id, event_type, payload_json, signature_verified, status)
         VALUES (?, ?, 'custom_api', ?, 'order_created', ?, 1, 'processed')`,
        ['wh_' + crypto.randomBytes(6).toString('hex'), companyId, idempotencyKey, JSON.stringify({ orderId })]
      );
    }

    res.status(201).json({ message: 'Commande créée avec succès', orderId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
