import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { execute, query, queryOne } from '../db/database.js';
import { requireAuth, requireTenant, AuthenticatedRequest } from '../auth/middleware.js';
import { WhatsAppService } from '../services/whatsappService.js';

const router = Router();

// GET /api/whatsapp/webhook - Meta Webhook Verification challenge
router.get('/webhook', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  // Check against environment verify token or tenant token
  const expectedToken = process.env.WHATSAPP_SYSTEM_VERIFY_TOKEN || 'opervia_webhook_verify_token_sample';

  // Also check if any tenant has this verify token
  const tenantIntegration = queryOne<{ company_id: string }>(
    `SELECT company_id FROM integrations WHERE type = 'whatsapp' AND webhook_secret = ?`,
    [token as string]
  );

  if (mode === 'subscribe' && (token === expectedToken || tenantIntegration)) {
    console.log('Meta WhatsApp webhook challenge verified successfully!');
    res.status(200).send(challenge);
    return;
  }

  res.status(403).send('Forbidden: Invalid verify token');
});

// POST /api/whatsapp/webhook - Incoming Meta WhatsApp Cloud API events
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-hub-signature-256'] as string;
    const rawBody = (req as any).rawBody || JSON.stringify(req.body);

    // Identify tenant or default to company
    const tenantId = (req.query.tenantId as string) || (req.headers['x-tenant-id'] as string);

    let appSecret = process.env.WHATSAPP_APP_SECRET || '';
    let targetCompanyId = tenantId;

    if (!targetCompanyId) {
      // Find first company with connected WhatsApp
      const waInt = queryOne<{ company_id: string; credentials_json: string }>(
        'SELECT company_id, credentials_json FROM integrations WHERE type = "whatsapp" LIMIT 1'
      );
      if (waInt) {
        targetCompanyId = waInt.company_id;
        try {
          const creds = JSON.parse(waInt.credentials_json || '{}');
          if (creds.appSecret) appSecret = creds.appSecret;
        } catch {
          // Ignore parse error
        }
      }
    }

    if (!targetCompanyId) {
      res.status(400).json({ error: 'Entreprise introuvable pour ce webhook' });
      return;
    }

    // Verify HMAC-SHA256 signature if appSecret is configured
    if (appSecret) {
      const isValid = WhatsAppService.verifySignature(rawBody, signature, appSecret);
      if (!isValid) {
        console.warn('WhatsApp webhook signature verification failed!');
        res.status(401).json({ error: 'Signature Meta WhatsApp non valide' });
        return;
      }
    }

    // Process payload
    const result = await WhatsAppService.processWebhookPayload(targetCompanyId, req.body);
    res.status(200).json({ status: 'ok', result });
  } catch (err: any) {
    console.error('Error processing WhatsApp webhook:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/whatsapp/status - Tenant's WhatsApp status
router.get('/status', requireAuth, requireTenant, (req: AuthenticatedRequest, res: Response) => {
  try {
    const integration = queryOne<{ status: string; credentials_json: string; webhook_secret: string; last_sync_at: string }>(
      'SELECT status, credentials_json, webhook_secret, last_sync_at FROM integrations WHERE company_id = ? AND type = "whatsapp"',
      [req.tenantId]
    );

    if (!integration) {
      res.json({
        connected: false,
        status: 'disconnected',
        message: 'Non connecté. Configurez vos identifiants Meta Cloud API.',
      });
      return;
    }

    let creds: any = {};
    try {
      creds = JSON.parse(integration.credentials_json || '{}');
    } catch {
      // ignore
    }

    res.json({
      connected: integration.status === 'connected',
      status: integration.status,
      phoneNumberId: creds.phoneNumberId ? `...${creds.phoneNumberId.slice(-4)}` : null,
      wabaId: creds.wabaId ? `...${creds.wabaId.slice(-4)}` : null,
      displayPhoneNumber: creds.displayPhoneNumber || null,
      webhookVerifyToken: integration.webhook_secret || 'opervia_webhook_verify_token_sample',
      webhookUrl: `${process.env.APP_URL || ''}/api/whatsapp/webhook?tenantId=${req.tenantId}`,
      lastSyncAt: integration.last_sync_at,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/whatsapp/templates - Tenant's approved templates
router.get('/templates', requireAuth, requireTenant, (req: AuthenticatedRequest, res: Response) => {
  try {
    const templates = query(
      'SELECT * FROM message_templates WHERE company_id = ? ORDER BY created_at DESC',
      [req.tenantId]
    );
    res.json({ templates });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/whatsapp/templates - Create template
router.post('/templates', requireAuth, requireTenant, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, category = 'utility', body, language = 'fr', variables } = req.body;
    if (!name || !body) {
      res.status(400).json({ error: 'Nom et contenu du modèle requis.' });
      return;
    }

    const templateId = 'tmpl_' + crypto.randomBytes(6).toString('hex');
    execute(
      `INSERT INTO message_templates (id, company_id, name, language, category, body, variables_json, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'approved')`,
      [templateId, req.tenantId, name.trim(), language, category, body.trim(), JSON.stringify(variables || [])]
    );

    res.status(201).json({ message: 'Modèle enregistré avec succès', templateId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
