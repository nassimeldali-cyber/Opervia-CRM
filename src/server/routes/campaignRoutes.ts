import { Router, Response } from 'express';
import crypto from 'crypto';
import { execute, query, queryOne } from '../db/database.js';
import { requireAuth, requireTenant, AuthenticatedRequest } from '../auth/middleware.js';
import { BackgroundWorker } from '../services/backgroundWorker.js';

const router = Router();

// GET /api/campaigns
router.get('/', requireAuth, requireTenant, (req: AuthenticatedRequest, res: Response) => {
  try {
    const campaigns = query(
      `SELECT c.*, t.name as template_name, t.category as template_category
       FROM campaigns c
       JOIN message_templates t ON t.id = c.template_id
       WHERE c.company_id = ?
       ORDER BY c.created_at DESC`,
      [req.tenantId]
    );

    res.json({ campaigns });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/campaigns/preview-audience - Estimate eligible recipients
router.post('/preview-audience', requireAuth, requireTenant, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { governorate, channel } = req.body;

    let sql = `
      SELECT COUNT(*) as total_eligible,
             SUM(CASE WHEN consent_status = 'opt_out' THEN 1 ELSE 0 END) as total_opted_out
      FROM customers
      WHERE company_id = ?
    `;
    const params: any[] = [req.tenantId];

    if (governorate && governorate !== 'all') {
      sql += ' AND governorate = ?';
      params.push(governorate);
    }

    if (channel && channel !== 'all') {
      sql += ' AND acquisition_channel = ?';
      params.push(channel);
    }

    const stats = queryOne<{ total_eligible: number; total_opted_out: number }>(sql, params);
    const eligibleCount = (stats?.total_eligible || 0) - (stats?.total_opted_out || 0);

    res.json({
      totalCandidates: stats?.total_eligible || 0,
      suppressedOptOut: stats?.total_opted_out || 0,
      eligibleRecipients: eligibleCount > 0 ? eligibleCount : 0,
      estimatedCostEur: ((eligibleCount > 0 ? eligibleCount : 0) * 0.035).toFixed(2), // Estimated Meta WhatsApp utility rate
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/campaigns - Create campaign
router.post('/', requireAuth, requireTenant, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, template_id, governorate, channel } = req.body;
    if (!name || !template_id) {
      res.status(400).json({ error: 'Nom et modèle WhatsApp requis' });
      return;
    }

    const campaignId = 'cmpg_' + crypto.randomBytes(6).toString('hex');
    const filterJson = JSON.stringify({ governorate, channel });

    // Find eligible customers with opt_in status
    let customerSql = 'SELECT id, phone FROM customers WHERE company_id = ? AND consent_status = "opt_in"';
    const params: any[] = [req.tenantId];
    if (governorate && governorate !== 'all') {
      customerSql += ' AND governorate = ?';
      params.push(governorate);
    }
    const recipients = query<{ id: string; phone: string }>(customerSql, params);

    execute(
      `INSERT INTO campaigns (id, company_id, name, template_id, status, target_filter_json, total_recipients)
       VALUES (?, ?, ?, ?, 'draft', ?, ?)`,
      [campaignId, req.tenantId, name.trim(), template_id, filterJson, recipients.length]
    );

    // Populate campaign recipients
    for (const r of recipients) {
      execute(
        `INSERT INTO campaign_recipients (id, company_id, campaign_id, customer_id, phone, status)
         VALUES (?, ?, ?, ?, ?, 'queued')`,
        ['cr_' + crypto.randomBytes(6).toString('hex'), req.tenantId, campaignId, r.id, r.phone]
      );
    }

    res.status(201).json({ message: 'Campagne créée', campaignId, recipientCount: recipients.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/campaigns/:id/launch - Launch campaign
router.post('/:id/launch', requireAuth, requireTenant, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const campaign = queryOne<{ id: string; status: string }>(
      'SELECT id, status FROM campaigns WHERE id = ? AND company_id = ?',
      [req.params.id, req.tenantId]
    );

    if (!campaign) {
      res.status(404).json({ error: 'Campagne introuvable' });
      return;
    }

    const recipients = query<{ id: string }>(
      'SELECT id FROM campaign_recipients WHERE campaign_id = ? AND status = "queued"',
      [campaign.id]
    );

    if (recipients.length === 0) {
      res.status(400).json({ error: 'Aucun destinataire éligible en attente' });
      return;
    }

    execute(
      'UPDATE campaigns SET status = "sending", scheduled_at = CURRENT_TIMESTAMP WHERE id = ?',
      [campaign.id]
    );

    // Queue in background worker
    const recipientIds = recipients.map((r) => r.id);
    await BackgroundWorker.enqueue(req.tenantId!, 'send_campaign_batch', {
      campaignId: campaign.id,
      recipientIds,
    });

    res.json({ message: 'Campagne mise en file d\'envoi avec succès.', count: recipients.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
